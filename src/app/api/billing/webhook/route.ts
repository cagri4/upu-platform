/**
 * POST /api/billing/webhook — Mollie webhook (bayi tenant).
 *
 * Mollie body: id=tr_xxx (form-encoded). Auth: ?secret=<MOLLIE_WEBHOOK_SECRET>
 * query param (Mollie HMAC göndermez — kendi shared-secret pattern).
 *
 * Akış:
 *   1. Secret doğrula
 *   2. Mollie payment fetch (id)
 *   3. metadata.tenant_key === "bayi" ise dispatch (diğer tenant'lar ayrı
 *      webhook /api/billing/mollie-webhook'a düşer — bu endpoint sadece bayi)
 *   4. status === "paid" + sequenceType === "first" → mandate aktif →
 *      recurring subscription create, subscriptions ACTIVE, agent_quotas
 *      plan_key güncelle
 *   5. status === "paid" + sequenceType === "recurring" → yenileme, period
 *      tarihleri ileri kaydır
 *   6. status === "failed"/"expired"/"canceled" → subscriptions status sync
 *
 * Mollie 200 OK bekler; aksi halde 24h boyunca exponential backoff retry.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import {
  getMollieClient, getBayiWebhookUrl,
} from "@/platform/billing/bayi-mollie";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function nextMonthIso(fromIso: string): string {
  // Mollie interval "1 month" — yaklaşık 30 gün; period tracking için.
  return addDaysIso(fromIso, 30);
}

export async function POST(req: NextRequest) {
  const url = req.nextUrl;
  const expected = process.env.MOLLIE_WEBHOOK_SECRET;
  const given = url.searchParams.get("secret");
  if (!expected || given !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let paymentId: string | null = null;
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      paymentId = (form.get("id") as string) || null;
    } else if (ct.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      paymentId = (body.id as string) || null;
    } else {
      const text = await req.text();
      const m = text.match(/(?:^|&)id=([^&]+)/);
      if (m) paymentId = decodeURIComponent(m[1]);
    }
  } catch {
    return NextResponse.json({ error: "Body parse failed" }, { status: 400 });
  }
  if (!paymentId) {
    return NextResponse.json({ error: "id eksik" }, { status: 400 });
  }

  const mollie = getMollieClient();
  let payment;
  try {
    payment = await mollie.payments.get(paymentId);
  } catch (err) {
    console.error("[billing/webhook] payment fetch err", err);
    return NextResponse.json({ error: "Payment fetch failed" }, { status: 500 });
  }

  const metadata = (payment.metadata as Record<string, string> | null) || {};
  // Sadece bayi tenant — diğer tenant'lar ayrı webhook'a düşer
  if (metadata.tenant_key !== "bayi") {
    return NextResponse.json({ ok: true, skipped: true, reason: "not_bayi_tenant" });
  }

  const userId = metadata.user_id;
  const tenantId = metadata.tenant_id;
  const planKey = metadata.plan_key;
  if (!userId || !planKey) {
    console.error("[billing/webhook] metadata eksik", metadata);
    return NextResponse.json({ ok: true, skipped: true, reason: "metadata_missing" });
  }

  const sb = getServiceClient();

  // Mevcut subscriptions row
  const { data: sub } = await sb
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  const status = payment.status;
  const sequenceType = payment.sequenceType;
  const customerId = payment.customerId || sub?.provider_customer_id || null;

  // FAIL / CANCEL / EXPIRE
  if (status === "failed" || status === "canceled" || status === "expired") {
    if (sub) {
      await sb.from("subscriptions").update({
        status: status === "failed" ? "past_due" : status === "canceled" ? "canceled" : "expired",
        updated_at: now,
      }).eq("user_id", userId);
    }
    return NextResponse.json({ ok: true, status });
  }

  // OPEN / PENDING / AUTHORIZED — henüz tamamlanmadı
  if (status !== "paid") {
    return NextResponse.json({ ok: true, status, waiting: true });
  }

  // FIRST PAYMENT PAID → recurring subscription oluştur
  if (sequenceType === "first") {
    if (!customerId) {
      console.error("[billing/webhook] first paid ama customerId yok", paymentId);
      return NextResponse.json({ ok: true, error: "customerId missing" });
    }

    // Mollie recurring subscription create
    try {
      const recurring = await mollie.customerSubscriptions.create({
        customerId,
        amount: payment.amount,
        interval: "1 month",
        description: payment.description || `UPU Bayi — ${planKey}`,
        webhookUrl: getBayiWebhookUrl(),
        metadata: {
          user_id: userId,
          tenant_id: tenantId || "",
          tenant_key: "bayi",
          plan_key: planKey,
        },
      });

      const periodEnd = nextMonthIso(now);
      if (sub) {
        await sb.from("subscriptions").update({
          provider_customer_id: customerId,
          provider_subscription_id: recurring.id,
          payment_provider: "mollie",
          plan: planKey,
          status: "active",
          amount: Number(payment.amount.value),
          currency: payment.amount.currency,
          current_period_start: now,
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          canceled_at: null,
          updated_at: now,
        }).eq("user_id", userId);
      } else {
        await sb.from("subscriptions").insert({
          user_id: userId,
          provider_customer_id: customerId,
          provider_subscription_id: recurring.id,
          payment_provider: "mollie",
          plan: planKey,
          status: "active",
          amount: Number(payment.amount.value),
          currency: payment.amount.currency,
          current_period_start: now,
          current_period_end: periodEnd,
        });
      }
    } catch (err) {
      console.error("[billing/webhook] recurring create err", err);
      return NextResponse.json({ error: "Recurring create failed" }, { status: 500 });
    }
  } else if (sequenceType === "recurring") {
    // Aylık recurring ödeme tamamlandı — period tarihleri ileri
    const periodEnd = nextMonthIso(now);
    if (sub) {
      await sb.from("subscriptions").update({
        status: "active",
        current_period_start: now,
        current_period_end: periodEnd,
        updated_at: now,
      }).eq("user_id", userId);
    }
  }

  // agent_quotas plan_key güncelle (aktif satır)
  const today = now.slice(0, 10);
  const { data: activeQuota } = await sb
    .from("agent_quotas")
    .select("user_id, period_start, plan_key")
    .eq("user_id", userId)
    .gte("period_end", today)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeQuota && activeQuota.plan_key !== planKey) {
    await sb.from("agent_quotas").update({
      plan_key: planKey,
      updated_at: now,
    }).eq("user_id", userId).eq("period_start", activeQuota.period_start);
  }

  return NextResponse.json({ ok: true, status: "paid", sequenceType, plan: planKey });
}
