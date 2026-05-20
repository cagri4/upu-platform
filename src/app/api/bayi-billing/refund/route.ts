/**
 * POST /api/bayi-billing/refund — 30 gün iade policy uygulayıcı endpoint.
 *
 * İade akışı:
 *   1. Müşteri WA'dan veya panelden "iade istiyorum" der
 *   2. Bu endpoint çağrılır → kullanıcının Stripe customer/subscription
 *      ID'si profile.metadata.stripe'tan okunur
 *   3. config.bayi.pricing.refund.firstNDays içinde mi? → değilse 410
 *   4. Stripe'a refund POST + subscription.cancel
 *   5. profile.metadata.refunded_at = now, status: cancelled
 *   6. Owner WA'sına bildirim
 *
 * MVP: STRIPE_API_KEY env-var yoksa 503 (placeholder); akış config-driven
 * hazır, billing entegrasyonu Stripe key gelince otomatik aktive olur.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { token?: string; reason?: string };
  try {
    body = await req.json() as { token?: string; reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; role: string | null; tenant_id: string;
    metadata: Record<string, unknown> | null; created_at: string;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role, tenant_id, metadata, created_at",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;
  if (profile.role !== "admin" && profile.role !== "user") {
    return NextResponse.json({ error: "Sadece firma sahibi iade isteyebilir." }, { status: 403 });
  }

  const tenant = getTenantByKey("bayi");
  const refundPolicy = tenant?.pricing.refund;
  if (!refundPolicy) {
    return NextResponse.json({ error: "Bu tenant için iade politikası tanımlı değil." }, { status: 410 });
  }

  // İade penceresi içinde mi? — profile.created_at base alınıyor
  const createdAt = new Date(profile.created_at);
  const refundDeadline = new Date(createdAt.getTime() + refundPolicy.firstNDays * 24 * 60 * 60 * 1000);
  if (new Date() > refundDeadline) {
    return NextResponse.json({
      error: `İade süresi dolmuş (${refundPolicy.firstNDays} gün limit). Hesabınız ${createdAt.toISOString().slice(0, 10)} tarihinde açıldı.`,
    }, { status: 410 });
  }

  // 2026-05-02: Stripe entegrasyonu kaldırıldı — UPU subscription tahsilatı
  // Mollie üzerinde planlanıyor (ileri faz). Şu an tüm iade talepleri
  // manuel işlenir: profile.metadata.refund_requests'e log atılır,
  // info@upudev.nl üzerinden 2 iş günü içinde el ile geri ödeme yapılır.
  const meta = (profile.metadata || {}) as Record<string, unknown>;
  const refundLog = (meta.refund_requests as unknown[] | undefined) || [];
  refundLog.push({
    requested_at: new Date().toISOString(),
    reason: body.reason || null,
    status: "pending_manual",
    policy_days: refundPolicy.firstNDays,
  });
  await supabase
    .from("profiles")
    .update({ metadata: { ...meta, refund_requests: refundLog } })
    .eq("id", profile.id);
  return NextResponse.json({
    success: true,
    manual: true,
    message: "İade talebiniz alındı. 2 iş günü içinde info@upudev.nl üzerinden işlenecek.",
  });
}
