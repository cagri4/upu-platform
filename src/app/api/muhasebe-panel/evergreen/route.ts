/**
 * /api/muhasebe-panel/evergreen?uid=<user_id>  (preferred — multi-tenant safe)
 * /api/muhasebe-panel/evergreen?phone=<phone>  (legacy fallback)
 *
 * "Süresi dolmaz" muhasebe panel link'i. WA mesajlarındaki "🖥 Paneli Aç"
 * CTA'ları bu URL'e iner; tıklandığında server fresh magic_link_token
 * mint edip /tr/panel'e (muhasebe henüz dedicated panel route'a sahip
 * değil; manifest.json/PANEL_START_URL ile aynı /tr/panel'e düşer) 302'ler.
 *
 * Pattern: bayi-panel/evergreen ile aynı; muhasebe tenant guard +
 * accountai.upudev.nl default.
 *
 * NOT: muhasebe için dedicated /tr/muhasebe-panel route'u eklendiğinde
 * burada da güncellenmeli (qr.ts + manifest.json + bu dosya senkron).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByKey } from "@/tenants/config";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://accountai.upudev.nl";

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get("uid");
  const phone = req.nextUrl.searchParams.get("phone");

  if (!uid && !phone) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const cfg = getTenantByKey("muhasebe");
  if (!cfg?.tenantId) {
    return NextResponse.redirect(`${APP_URL}/tr`);
  }

  const sb = getServiceClient();
  let userId: string | null = null;

  if (uid) {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .or(`id.eq.${uid},auth_user_id.eq.${uid}`)
      .eq("tenant_id", cfg.tenantId)
      .maybeSingle();
    if (data) userId = data.id;
  }

  if (!userId && phone) {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", phone)
      .eq("tenant_id", cfg.tenantId)
      .limit(1);
    if (data && data.length > 0) userId = data[0].id;
  }

  if (!userId) return NextResponse.redirect(`${APP_URL}/tr`);

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: userId,
    token,
    expires_at: expiresAt,
  });

  return NextResponse.redirect(`${APP_URL}/tr/panel?t=${token}`);
}
