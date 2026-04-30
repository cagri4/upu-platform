/**
 * POST /api/mollie/webhook — Mollie payment status updates.
 *
 * Mollie webhook payment_id gönderir; biz Mollie API'ye get yapıp
 * status'u alırız. status === "paid" ise:
 *   - bayi_dealer_invoices.is_paid = true
 *   - bayi_dealer_transactions'a "payment" kaydı
 *   - cari hesap bakiyesi düşülür (trigger DB'de yoksa app-level)
 *
 * Mollie webhook body: form-encoded `id=tr_xxxxx`. Kaydı bulup
 * Mollie API'den fresh status alıyoruz (replay-safe).
 *
 * MVP: MOLLIE_API_KEY env-var yoksa 503.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const MOLLIE_API_BASE = "https://api.mollie.com/v2";

export async function POST(req: NextRequest) {
  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Mollie not configured" }, { status: 503 });
  }

  // Mollie webhook body form-encoded; alternatively JSON
  let paymentId: string | null = null;
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await req.formData();
    paymentId = body.get("id") as string | null;
  } else {
    try {
      const json = await req.json() as { id?: string };
      paymentId = json.id || null;
    } catch {
      paymentId = null;
    }
  }

  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
  }

  // Fetch fresh payment status from Mollie
  const res = await fetch(`${MOLLIE_API_BASE}/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.error("[mollie:webhook] payment fetch failed", res.status);
    return NextResponse.json({ error: "Payment fetch failed" }, { status: 500 });
  }

  const payment = await res.json() as {
    id: string;
    status: string;
    amount?: { value: string; currency: string };
    metadata?: { invoice_id?: string };
  };

  // Idempotent: only process "paid" once
  if (payment.status !== "paid") {
    return NextResponse.json({ ok: true, status: payment.status });
  }

  const invoiceId = payment.metadata?.invoice_id;
  if (!invoiceId) {
    console.warn("[mollie:webhook] no invoice_id in metadata", payment.id);
    return NextResponse.json({ ok: true, ignored: "no invoice_id" });
  }

  const supabase = getServiceClient();

  // Mark invoice paid (idempotent — eq is_paid false to skip if already)
  const { data: invoice } = await supabase
    .from("bayi_dealer_invoices")
    .select("id, dealer_id, amount, is_paid, tenant_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) {
    return NextResponse.json({ ok: true, ignored: "invoice not found" });
  }
  if (invoice.is_paid) {
    return NextResponse.json({ ok: true, ignored: "already paid" });
  }

  await supabase
    .from("bayi_dealer_invoices")
    .update({
      is_paid: true,
      paid_at: new Date().toISOString(),
      payment_method: "mollie",
      payment_external_id: payment.id,
    })
    .eq("id", invoiceId);

  // Cari hesap hareketi
  await supabase
    .from("bayi_dealer_transactions")
    .insert({
      tenant_id: invoice.tenant_id,
      dealer_id: invoice.dealer_id,
      amount: -Math.abs(invoice.amount),  // ödeme negatif (borç düşer)
      type: "payment",
      reference: `Mollie ${payment.id}`,
      created_at: new Date().toISOString(),
    });

  // Bayi balance düşür (trigger yoksa app-level)
  const { data: dealer } = await supabase
    .from("bayi_dealers")
    .select("balance")
    .eq("id", invoice.dealer_id)
    .maybeSingle();
  if (dealer) {
    await supabase
      .from("bayi_dealers")
      .update({ balance: (dealer.balance || 0) - invoice.amount })
      .eq("id", invoice.dealer_id);
  }

  console.log("[mollie:webhook] invoice paid", { invoiceId, paymentId: payment.id });
  return NextResponse.json({ ok: true });
}
