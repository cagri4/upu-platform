/**
 * GET /api/restoran-panel/start?t=<panel_token>
 *
 * Restoran panel'e giriş için yeni magic_link_token mint edip /tr/restoran-panel'e
 * 302 redirect eder. WA'daki "🖥 Paneli Aç" butonu bu endpoint'e link verir;
 * her tıklamada YENİ token üretildiği için single-use form save token'ı
 * panel oturumunu bozmaz.
 *
 * Pattern: emlak'ın /api/panel/start endpoint'i — sadeleştirilmiş varyant
 * (yardim-content lookup yok, direkt /tr/restoran-panel).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL_RESTORAN || "https://restoranai.upudev.nl";

export async function GET(req: NextRequest) {
  const panelToken = req.nextUrl.searchParams.get("t");
  if (!panelToken) {
    return NextResponse.redirect(`${APP_URL}/tr/restoran-panel`);
  }

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", panelToken)
    .maybeSingle();

  if (!pt || new Date(pt.expires_at) < new Date()) {
    return NextResponse.redirect(`${APP_URL}/tr/restoran-panel`);
  }

  // Yeni token mint (7-gün TTL — re-openable panel için)
  const newToken = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: pt.user_id,
    token: newToken,
    expires_at: expiresAt,
  });

  return NextResponse.redirect(`${APP_URL}/tr/restoran-panel?t=${newToken}`);
}
