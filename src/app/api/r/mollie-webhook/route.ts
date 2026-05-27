/**
 * POST /api/r/mollie-webhook
 *
 * Mollie payment status webhook'u. Akış:
 *   1. Mollie body: form-encoded `id=<payment_id>` (signature yok)
 *   2. Mollie API'den payment GET → status doğrula (idempotent)
 *   3. rst_b2c_orders → mollie_payment_id eşleştir, status update
 *   4. status='paid' → order.status = 'received' (Realtime ile panel'e push)
 *   5. status='failed'/'canceled'/'expired' → order.payment_status update,
 *      order.status pending_payment'ta kalır (cleanup cron iptal eder)
 *
 * Webhook signature: Mollie HMAC signature kullanmaz (sadece payment ID
 * gönderir). Doğrulama = Mollie'den fetch ederek (man-in-the-middle bypass).
 *
 * Idempotency: aynı payment_id birden çok webhook fire edebilir. Status
 * değişimi idempotent — aynı status'a update'in zararı yok.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import {
  getOrderPayment,
  molliePaymentStatusToDb,
  shouldOrderBeReceived,
} from "@/platform/mollie/restoran-payments";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Mollie webhook body: application/x-www-form-urlencoded → `id=tr_xxx`
    const form = await req.formData();
    const paymentId = String(form.get("id") || "").trim();

    if (!paymentId.startsWith("tr_")) {
      console.warn("[r/mollie-webhook] invalid payment id format", paymentId);
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Mollie'den payment fetch (doğrulama + son durum)
    let payment;
    try {
      payment = await getOrderPayment(paymentId);
    } catch (err) {
      console.error("[r/mollie-webhook] Mollie fetch error", err);
      return NextResponse.json({ ok: false }, { status: 502 });
    }

    const orderId = payment.metadata?.order_id;
    if (!orderId) {
      console.warn("[r/mollie-webhook] payment metadata.order_id yok", paymentId);
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const sb = getServiceClient();

    // Order lookup
    const { data: order } = await sb
      .from("rst_b2c_orders")
      .select("id, status, payment_status, mollie_payment_id")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      console.warn("[r/mollie-webhook] order bulunamadı", orderId);
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    // Idempotent check — mollie_payment_id eşleşmesi şart
    if (order.mollie_payment_id && order.mollie_payment_id !== paymentId) {
      console.warn("[r/mollie-webhook] payment ID mismatch", { orderId, expected: order.mollie_payment_id, got: paymentId });
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const dbPaymentStatus = molliePaymentStatusToDb(payment.status);
    const updates: Record<string, string | null> = {
      payment_status: dbPaymentStatus,
    };

    // Paid → order received (Realtime → panel'e push)
    if (shouldOrderBeReceived(payment.status) && order.status === "pending_payment") {
      updates.status = "received";
    }

    // Failed/expired → order cancelled (cleanup için)
    if ((dbPaymentStatus === "failed" || dbPaymentStatus === "expired") && order.status === "pending_payment") {
      updates.status = "cancelled";
      updates.cancel_reason = `payment_${dbPaymentStatus}`;
      updates.cancelled_at = new Date().toISOString();
    }

    await sb.from("rst_b2c_orders").update(updates).eq("id", orderId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[r/mollie-webhook] error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
