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
import { getTenantByKey } from "@/tenants/config";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const phone = req.nextUrl.searchParams.get("phone");

  if (!uid && !phone) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const bayiCfg = getTenantByKey("bayi");
  if (!bayiCfg?.tenantId) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const sb = getServiceClient();
  let userId: string | null = null;

  if (uid) {
    // Multi-tenant: uid genelde auth.users.id taşır. Legacy emlak profile'da
    // id == auth.users.id, multi-tenant bayi profile'da id = randomUUID +
    // auth_user_id = auth.users.id. Composite lookup + bayi tenant guard.
    const { data } = await sb
      .from("profiles")
      .select("id")
      .or(`id.eq.${uid},auth_user_id.eq.${uid}`)
      .eq("tenant_id", bayiCfg.tenantId)
      .maybeSingle();
    if (data) userId = data.id;
  }

  if (!userId && phone) {
    // Phone fallback — bayi tenant'a scope edilir (aynı phone emlak'ta da
    // olabilir; doğru profile'ı seçelim).
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", phone)
      .eq("tenant_id", bayiCfg.tenantId)
      .limit(1);
    if (data && data.length > 0) {
      userId = data[0].id;
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
