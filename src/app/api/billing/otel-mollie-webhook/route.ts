/**
 * /api/billing/otel-mollie-webhook — Mollie payment status callback (Faz 4)
 *
 * Mollie payment status değişimi → otel_payments.status sync.
 * Webhook body: { id: "tr_xxx" }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getOtelPayment } from "@/platform/mollie/otel-payments";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    let mollieId = formData?.get("id")?.toString();
    if (!mollieId) {
      const body = await req.json().catch(() => ({} as any));
      mollieId = body?.id;
    }
    if (!mollieId) return NextResponse.json({ ok: false, error: "id eksik" }, { status: 400 });

    const sb = getServiceClient();
    const { data: payment } = await sb
      .from("otel_payments")
      .select("id, status")
      .eq("provider_payment_id", mollieId)
      .maybeSingle();
    if (!payment) {
      // Webhook gelse de DB kaydı yoksa 200 dön (Mollie retry yapmasın)
      return NextResponse.json({ ok: true, ignored: true });
    }

    const m = await getOtelPayment(mollieId);
    const updates: Record<string, any> = {
      status: m.status,
      updated_at: new Date().toISOString(),
    };
    if (m.status === "paid" && m.paidAt) updates.paid_at = m.paidAt;

    await sb.from("otel_payments").update(updates).eq("id", payment.id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[otel-mollie-webhook] error:", err);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
