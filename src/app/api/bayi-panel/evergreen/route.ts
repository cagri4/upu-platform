/**
 * /api/bayi-panel/evergreen?uid=<user_id>  (preferred — multi-tenant safe)
 * /api/bayi-panel/evergreen?phone=<phone>  (legacy fallback)
 *
 * "Süresi dolmaz" bayi panel link'i. WA mesajlarındaki "🖥 Panele Git" CTA'ları
 * bu URL'e yönlendirir; tıklandığında server fresh magic_link_token mint
 * edip /tr/bayi-panel'e 302'ler. Eski mesajlardan tıklasalar bile çalışır.
 *
 * Pattern: emlak /api/panel/evergreen — bayi-spesifik redirect target
 * (/tr/bayi-panel) ve domain default (retailai.upudev.nl).
 *
 * Multi-tenant fix: aynı whatsapp_phone'a birden fazla profil olabilir
 * (kullanıcı hem emlak hem bayi tenant'ında). uid query param tercih edilir
 * (her profile unique). phone fallback yalnız tek profil eşleşmesi varsa
 * temizdir; multi-match durumunda first row alınır + log warning.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const phone = req.nextUrl.searchParams.get("phone");

  if (!uid && !phone) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const sb = getServiceClient();
  let userId: string | null = null;

  if (uid) {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("id", uid)
      .maybeSingle();
    if (data) userId = data.id;
  }

  if (!userId && phone) {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", phone)
      .limit(1);
    if (data && data.length > 0) {
      userId = data[0].id;
      const { count } = await sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("whatsapp_phone", phone);
      if ((count ?? 0) > 1) {
        console.warn(`[bayi-panel:evergreen] phone ${phone} matches ${count} profiles, used first (uid param tercih edilmeli)`);
      }
    }
  }

  if (!userId) return NextResponse.redirect(`${APP_URL}/tr`);

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 saat
  await sb.from("magic_link_tokens").insert({
    user_id: userId,
    token,
    expires_at: expiresAt,
  });

  return NextResponse.redirect(`${APP_URL}/tr/bayi-panel?t=${token}`);
}
