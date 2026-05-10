/**
 * Mollie webhook — payment ve subscription event'leri.
 *
 * Mollie body'de bir `id` POST eder (form-encoded). Bu ID payment_xxx veya
 * sub_xxx olabilir. ID'yi Mollie API'den fetch edip status'u oku.
 *
 * Idempotent — aynı event tekrar gönderilebilir.
 *
 * Senaryolar:
 * - payment.status='paid' && sequenceType='first' → mandate ready,
 *   createSubscription ile recurring başlat
 * - payment.status='paid' && sequenceType='recurring' → period uzat
 * - payment.status='failed'/'canceled'/'expired' → past_due/canceled
 * - subscription event → status'u DB'ye yansıt (canceled, completed)
 *
 * Auth: yok — Mollie kendi imza scheme'i kullanmıyor (bu API). Webhook
 * URL'si secret'a benzer şekilde unguessable; ekstra güvenlik için
 * MOLLIE_WEBHOOK_SECRET'ı path'e ekleyebiliriz ama Mollie spec değil.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import {
  getPayment,
  getSubscription as mollieGetSubscription,
  createSubscription,
  type Plan,
} from "@/platform/billing/mollie";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let id: string | null = null;
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      id = params.get("id");
    } else {
      // application/json fallback
      try {
        const body = await req.json();
        id = (body?.id as string | undefined) || null;
      } catch {
        // ignore
      }
    }
    if (!id) {
      console.warn("[mollie-webhook] missing id");
      return NextResponse.json({ ok: true }); // Mollie 200 bekler
    }

    if (id.startsWith("tr_") || id.startsWith("payment_")) {
      await handlePayment(id);
    } else if (id.startsWith("sub_")) {
      await handleSubscription(id);
    } else {
      console.warn("[mollie-webhook] unknown id prefix:", id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mollie-webhook]", err);
    // Mollie 200 bekler — yoksa retry eder
    return NextResponse.json({ ok: true });
  }
}

async function handlePayment(paymentId: string) {
  const sb = getServiceClient();
  const payment = await getPayment(paymentId);
  const userId = payment.metadata?.user_id;
  const plan = payment.metadata?.plan as Plan | undefined;
  if (!userId) {
    console.warn("[mollie-webhook] payment without user_id metadata", paymentId);
    return;
  }

  if (payment.status === "paid" && payment.sequenceType === "first") {
    // Mandate kayıt edildi — şimdi recurring subscription oluştur
    if (!payment.customerId || !plan) {
      console.warn("[mollie-webhook] missing customerId/plan on first payment");
      return;
    }
    // Idempotent: zaten provider_subscription_id varsa atla
    const { data: existing } = await sb
      .from("subscriptions")
      .select("provider_subscription_id, plan, status")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.provider_subscription_id) {
      console.log("[mollie-webhook] subscription already exists, skipping create");
    } else {
      try {
        const sub = await createSubscription({
          customerId: payment.customerId,
          plan,
          userId,
        });
        const periodStart = new Date().toISOString();
        const periodEnd = computePeriodEnd(plan);
        await sb
          .from("subscriptions")
          .update({
            plan,
            status: "active",
            payment_provider: "mollie",
            provider_customer_id: payment.customerId,
            provider_subscription_id: sub.id,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: false,
            canceled_at: null,
          })
          .eq("user_id", userId);
      } catch (err) {
        console.error("[mollie-webhook] createSubscription failed", err);
      }
    }
  } else if (payment.status === "paid" && payment.sequenceType === "recurring") {
    // Periyot uzat
    if (!plan) return;
    const periodStart = new Date().toISOString();
    const periodEnd = computePeriodEnd(plan);
    await sb
      .from("subscriptions")
      .update({
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
      })
      .eq("user_id", userId);
  } else if (payment.status === "failed" || payment.status === "canceled" || payment.status === "expired") {
    // Recurring başarısız → past_due
    if (payment.sequenceType === "recurring") {
      await sb
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("user_id", userId);
    }
  }
}

async function handleSubscription(subId: string) {
  const sb = getServiceClient();
  const { data: row } = await sb
    .from("subscriptions")
    .select("user_id, provider_customer_id")
    .eq("provider_subscription_id", subId)
    .maybeSingle();
  if (!row?.provider_customer_id || !row?.user_id) return;

  const sub = await mollieGetSubscription(row.provider_customer_id as string, subId);
  if (sub.status === "canceled" || sub.status === "completed" || sub.status === "suspended") {
    await sb
      .from("subscriptions")
      .update({
        status: "canceled",
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
      })
      .eq("user_id", row.user_id);
  }
}

function computePeriodEnd(plan: Plan): string {
  const now = new Date();
  if (plan === "pro_yearly") {
    now.setFullYear(now.getFullYear() + 1);
  } else {
    now.setMonth(now.getMonth() + 1);
  }
  return now.toISOString();
}
