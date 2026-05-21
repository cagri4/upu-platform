/**
 * POST /api/billing/checkout — bayi plan yükseltme akışı başlatır.
 *
 * Body: { plan_key: "starter" | "pro" | "premium" }
 *
 * Akış:
 *   1. agent_plans'tan price oku (EUR)
 *   2. Mevcut subscriptions row'dan provider_customer_id oku, yoksa Mollie
 *      customer create
 *   3. Mollie first payment (sequenceType='first') — kullanıcı kart bilgisi
 *      verir, mandate alır
 *   4. Response: { checkout_url } — UI redirect
 *   5. Webhook payment.paid → /api/billing/webhook recurring subscription
 *      oluşturur
 *
 * NOT: Free plan ücretsiz — bu endpoint yalnız ücretli tier'lar için.
 * Mevcut active subscription downgrade için /api/billing/cancel ayrı.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { SequenceType } from "@mollie/api-client";
import {
  getMollieClient, getBayiReturnUrl, getBayiWebhookUrl,
} from "@/platform/billing/bayi-mollie";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["admin", "user"]);
const PAID_PLANS = new Set(["starter", "pro", "premium"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const planKey = String(body.plan_key || "").trim().toLowerCase();
  if (!PAID_PLANS.has(planKey)) {
    return NextResponse.json({
      error: "Geçerli plan: starter / pro / premium (free ücretsiz, checkout gerekmez).",
    }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null;
    display_name: string | null; email: string | null; invited_by: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, role, display_name, email, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ADMIN_ROLES.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Plan değişikliği için admin yetkisi gerekli." }, { status: 403 });
  }

  // Owner profili (tenant'ın faturalama sahibi)
  const ownerId = lookup.profile.invited_by || lookup.profile.id;
  const { data: owner } = await sb
    .from("profiles")
    .select("id, display_name, email, whatsapp_phone")
    .eq("id", ownerId)
    .maybeSingle();
  if (!owner) return NextResponse.json({ error: "Owner profili bulunamadı." }, { status: 500 });

  // Plan price
  const { data: plan } = await sb
    .from("agent_plans")
    .select("key, display_name, monthly_price_eur")
    .eq("key", planKey)
    .maybeSingle();
  if (!plan || plan.monthly_price_eur === null || Number(plan.monthly_price_eur) <= 0) {
    return NextResponse.json({ error: "Plan ücretlendirmesi yapılandırılmamış." }, { status: 500 });
  }
  const amountStr = Number(plan.monthly_price_eur).toFixed(2);

  // Existing subscription → reuse customer
  const { data: existingSub } = await sb
    .from("subscriptions")
    .select("user_id, plan, status, provider_customer_id, provider_subscription_id")
    .eq("user_id", owner.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const mollie = getMollieClient();
  let customerId = existingSub?.provider_customer_id || null;

  if (!customerId) {
    const customer = await mollie.customers.create({
      email: owner.email || `${owner.id}@placeholder.upudev.nl`,
      name: owner.display_name || "UPU Bayi",
      locale: "tr_NL",
      metadata: { user_id: owner.id, tenant_id: lookup.tenantId, tenant_key: "bayi" },
    });
    customerId = customer.id;
  }

  // First payment — mandate alır
  const payment = await mollie.payments.create({
    amount: { currency: "EUR", value: amountStr },
    description: `UPU Bayi — ${plan.display_name} (ilk ödeme)`,
    redirectUrl: getBayiReturnUrl("success"),
    webhookUrl: getBayiWebhookUrl(),
    customerId,
    sequenceType: SequenceType.first,
    metadata: {
      user_id: owner.id,
      tenant_id: lookup.tenantId,
      tenant_key: "bayi",
      plan_key: planKey,
      type: "first_payment",
    },
  });

  // Subscription row — pending olarak işaretle (webhook active'e çevirir)
  if (existingSub) {
    await sb.from("subscriptions").update({
      provider_customer_id: customerId,
      payment_provider: "mollie",
      plan: planKey,
      status: "pending",
      amount: Number(amountStr),
      currency: "EUR",
      updated_at: new Date().toISOString(),
    }).eq("user_id", owner.id);
  } else {
    await sb.from("subscriptions").insert({
      user_id: owner.id,
      payment_provider: "mollie",
      provider_customer_id: customerId,
      plan: planKey,
      status: "pending",
      amount: Number(amountStr),
      currency: "EUR",
    });
  }

  const checkoutUrl = payment.getCheckoutUrl();
  if (!checkoutUrl) {
    return NextResponse.json({ error: "Mollie checkout URL alınamadı." }, { status: 500 });
  }
  return NextResponse.json({ success: true, checkout_url: checkoutUrl, payment_id: payment.id });
}
