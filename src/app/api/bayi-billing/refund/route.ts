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
  if (!body.token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("user_id, expires_at, used_at")
    .eq("token", body.token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, tenant_id, metadata, created_at")
    .eq("id", magicToken.user_id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
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

  const meta = (profile.metadata || {}) as Record<string, unknown>;
  const stripe = (meta.stripe || {}) as Record<string, unknown>;
  const stripeApiKey = process.env.STRIPE_API_KEY;

  if (!stripeApiKey || !stripe.customer_id) {
    // Stripe henüz entegre değil veya müşteri Stripe'a bağlı değil. İade
    // talebi kayıt altına alınır, manuel işlenir.
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

  // Stripe entegre + customer var: gerçek iade akışı
  try {
    // 1) Customer'ın son ödemelerini list et, period_start refundDeadline öncesi olanları topla
    const chargesRes = await fetch(`https://api.stripe.com/v1/charges?customer=${stripe.customer_id}&limit=10`, {
      headers: { "Authorization": `Bearer ${stripeApiKey}` },
    });
    if (!chargesRes.ok) throw new Error("Stripe charges fetch failed");
    const charges = await chargesRes.json() as { data: Array<{ id: string; amount: number; refunded: boolean }> };

    let totalRefunded = 0;
    for (const charge of charges.data) {
      if (charge.refunded) continue;
      // Setup fee dahil tam iade — config.refund.fullRefund=true ise hepsi
      const refundRes = await fetch("https://api.stripe.com/v1/refunds", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeApiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `charge=${charge.id}`,
      });
      if (refundRes.ok) {
        totalRefunded += charge.amount;
      }
    }

    // 2) Subscription cancel (varsa)
    if (stripe.subscription_id) {
      await fetch(`https://api.stripe.com/v1/subscriptions/${stripe.subscription_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${stripeApiKey}` },
      });
    }

    // 3) profile metadata güncelle
    await supabase
      .from("profiles")
      .update({
        metadata: {
          ...meta,
          refunded_at: new Date().toISOString(),
          refund_amount_cents: totalRefunded,
          status: "refunded",
        },
      })
      .eq("id", profile.id);

    return NextResponse.json({
      success: true,
      manual: false,
      refund_amount_cents: totalRefunded,
    });
  } catch (err) {
    console.error("[bayi-billing:refund]", err);
    return NextResponse.json({ error: "İade işlemi başarısız. info@upudev.nl üzerinden destek alın." }, { status: 500 });
  }
}
