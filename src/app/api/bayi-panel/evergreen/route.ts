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
import { getAllTenantIdsForSaas } from "@/platform/auth/multi-tenant";
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
  if (!bayiCfg?.saasType) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const sb = getServiceClient();
  // Multi-tenant fix (2026-06-05): cfg.tenantId DEMO sabiti; runtime
  // signup'lar yeni tenants satırı yaratır. saas_type üzerinden tüm
  // tenant id'lerini topla.
  const tenantIds = await getAllTenantIdsForSaas(sb, bayiCfg.saasType);
  if (tenantIds.length === 0) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }
  let userId: string | null = null;

  if (uid) {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .or(`id.eq.${uid},auth_user_id.eq.${uid}`)
      .in("tenant_id", tenantIds)
      .limit(1)
      .maybeSingle();
    if (data) userId = data.id;
  }

  if (!userId && phone) {
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

  return NextResponse.redirect(`${APP_URL}/tr/bayi-panel?t=${token}`);
}
