/**
 * /api/panel/start?cmd=<command>&t=<panel_token>
 *
 * Panel "Başlat" buton handler'ı — her tıklamada YENİ magic link token
 * üretip ilgili form sayfasına 302 redirect eder. Eski davranış: panel
 * token'ı tüm Başlat link'lerinde paylaşılırdı; ilk form save token'ı
 * used_at işaretleyince panel'e dönüp ikinci Başlat "kullanılmış" hatası
 * veriyordu (kullanıcı raporu 2026-05-06).
 *
 * Akış:
 *   1. panel_token doğrula (expires_at; used_at SET ETMİYOR çünkü panel
 *      sayfası tekrar açılabilir olmalı).
 *   2. yardim-content'ten command'ın startAction'ını oku.
 *   3. type=web → yeni magic_link_token mint + 302 to /tr/<path>?t=<new>
 *      type=wa  → 302 to wa.me/<bot>?text=<command>
 *   4. Geçersiz panel_token → /tr/panel'e geri yönlendir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";
import { getYardimEntry } from "@/lib/yardim-content";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getSessionFromCookies } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
const BOT_PHONE = "31644967207";

export async function GET(req: NextRequest) {
  const cmd = req.nextUrl.searchParams.get("cmd");
  if (!cmd) {
    return NextResponse.redirect(`${APP_URL}/tr/panel`);
  }

  // Auth resolution: cookie session öncelik, token fallback (legacy WA link'ler)
  const session = await getSessionFromCookies();
  const hasCookieSession = !!session?.uid;
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.redirect(`${APP_URL}/tr/panel`);
  }

  const entry = getYardimEntry(cmd);
  if (!entry?.startAction) {
    return NextResponse.redirect(`${APP_URL}/tr/panel`);
  }

  if (entry.startAction.type === "wa") {
    const url = `https://wa.me/${BOT_PHONE}?text=${encodeURIComponent(entry.startAction.text)}`;
    return NextResponse.redirect(url);
  }

  // type === "web"
  // Cookie fast-path: kullanıcı zaten oturumlu — token mint etmiyoruz,
  // form sayfası cookie ile çalışır (/api/panel/cookie-check ile validate eder).
  if (hasCookieSession) {
    return NextResponse.redirect(`${APP_URL}${entry.startAction.path}`);
  }

  // Token path (legacy WA link). Yeni magic_link_token mint + redirect.
  const sb = getServiceClient();
  const newToken = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: auth.userId,
    token: newToken,
    expires_at: expires,
  });

  const url = `${APP_URL}${entry.startAction.path}?t=${newToken}`;
  return NextResponse.redirect(url);
}
