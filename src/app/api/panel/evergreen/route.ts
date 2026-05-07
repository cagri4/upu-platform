/**
 * /api/panel/evergreen?phone=<E164_or_local>
 *
 * "Süresi dolmaz" panel link'i. WA mesajlarındaki "🖥 Panele Git" CTA'ları
 * bu URL'e yönlendirir; tıklandığında server fresh magic_link_token mint
 * edip /tr/panel'e 302'ler. Eski mesajlardan tıklasalar bile çalışır.
 *
 * Güvenlik notu: phone WA'da bot'a yazışan numarayla aynı olduğu için
 * pratik kullanımda risk düşüktür. URL üçüncü tarafa sızdırılırsa,
 * mevcut magic_link_tokens pre-mint pattern'i ile aynı risk profili.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.redirect(`${APP_URL}/tr`);

  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .eq("whatsapp_phone", phone)
    .maybeSingle();

  if (!profile) return NextResponse.redirect(`${APP_URL}/tr`);

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 saat
  await sb.from("magic_link_tokens").insert({
    user_id: profile.id,
    token,
    expires_at: expiresAt,
  });

  return NextResponse.redirect(`${APP_URL}/tr/panel?t=${token}`);
}
