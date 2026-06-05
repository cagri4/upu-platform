/**
 * /api/site-panel/evergreen?uid=<user_id>  (preferred — multi-tenant safe)
 * /api/site-panel/evergreen?phone=<phone>  (legacy fallback)
 *
 * "Süresi dolmaz" siteyönetim panel link'i. WA mesajlarındaki "🖥 Paneli Aç"
 * CTA'ları bu URL'e yönlendirir; tıklandığında server fresh magic_link_token
 * mint edip /tr/site'e 302'ler. Eski mesajlardan tıklasalar bile çalışır.
 *
 * Pattern: bayi /api/bayi-panel/evergreen ile aynı — siteyönetim-spesifik
 * redirect target (/tr/site) ve domain default (residenceai.upudev.nl).
 *
 * organic-signup.ts evergreenPath: "/api/site-panel/evergreen" çağrısı bu
 * route'a iner; ?uid= veya ?phone= ile profile lookup yapılır.
 *
 * Multi-tenant guard: aynı whatsapp_phone birden fazla tenant'ta olabilir
 * (kullanıcı hem emlak hem siteyönetim). uid query param tercih edilir
 * (her profile unique). phone fallback siteyönetim tenant'ına scope edilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByKey } from "@/tenants/config";
import { getAllTenantIdsForSaas } from "@/platform/auth/multi-tenant";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://residenceai.upudev.nl";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const phone = req.nextUrl.searchParams.get("phone");

  if (!uid && !phone) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const siteCfg = getTenantByKey("siteyonetim");
  if (!siteCfg?.saasType) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const sb = getServiceClient();
  const tenantIds = await getAllTenantIdsForSaas(sb, siteCfg.saasType);
  if (tenantIds.length === 0) return NextResponse.redirect(`${APP_URL}/tr`);
  let userId: string | null = null;

  if (uid) {
    // Multi-tenant: uid genelde auth.users.id taşır. Legacy emlak profile'da
    // id == auth.users.id, multi-tenant siteyönetim profile'da id = randomUUID +
    // auth_user_id = auth.users.id. Composite lookup + siteyönetim tenant guard.
    const { data } = await sb
      .from("profiles")
      .select("id")
      .or(`id.eq.${uid},auth_user_id.eq.${uid}`)
      .in("tenant_id", tenantIds)
      .maybeSingle();
    if (data) userId = data.id;
  }

  if (!userId && phone) {
    // Phone fallback — siteyönetim tenant'a scope edilir (aynı phone emlak'ta
    // da olabilir; doğru profile'ı seçelim).
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", phone)
      .in("tenant_id", tenantIds)
      .limit(1);
    if (data && data.length > 0) {
      userId = data[0].id;
    }
  }

  if (!userId) return NextResponse.redirect(`${APP_URL}/tr`);

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 saat (Çağrı 2026-05-27 onayı)
  await sb.from("magic_link_tokens").insert({
    user_id: userId,
    token,
    expires_at: expiresAt,
  });

  return NextResponse.redirect(`${APP_URL}/tr/site?t=${token}`);
}
