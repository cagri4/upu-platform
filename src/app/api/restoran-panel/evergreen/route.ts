/**
 * /api/restoran-panel/evergreen?uid=<user_id>  (preferred — multi-tenant safe)
 * /api/restoran-panel/evergreen?phone=<phone>  (legacy fallback)
 *
 * "Süresi dolmaz" restoran panel link'i. WA mesajlarındaki "🖥 Paneli Aç"
 * CTA'ları bu URL'e iner; tıklandığında server fresh magic_link_token
 * mint edip /tr/restoran-panel'e 302'ler.
 *
 * Pattern: bayi-panel/evergreen ile aynı; restoran tenant guard +
 * restoranai.upudev.nl default.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByKey } from "@/tenants/config";
import { getAllTenantIdsForSaas } from "@/platform/auth/multi-tenant";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://restoranai.upudev.nl";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const phone = req.nextUrl.searchParams.get("phone");

  if (!uid && !phone) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const cfg = getTenantByKey("restoran");
  if (!cfg?.saasType) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const sb = getServiceClient();
  const tenantIds = await getAllTenantIdsForSaas(sb, cfg.saasType);
  if (tenantIds.length === 0) return NextResponse.redirect(`${APP_URL}/tr`);
  let userId: string | null = null;

  if (uid) {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .or(`id.eq.${uid},auth_user_id.eq.${uid}`)
      .in("tenant_id", tenantIds)
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
    if (data && data.length > 0) userId = data[0].id;
  }

  if (!userId) return NextResponse.redirect(`${APP_URL}/tr`);

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 saat
  await sb.from("magic_link_tokens").insert({
    user_id: userId,
    token,
    expires_at: expiresAt,
  });

  return NextResponse.redirect(`${APP_URL}/tr/restoran-panel?t=${token}`);
}
