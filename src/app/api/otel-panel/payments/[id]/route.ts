/**
 * /api/otel-panel/payments/[id] — Ödeme güncelleme / iptal / iade (Faz 4)
 *
 * PATCH body: { action: "mark_paid"|"cancel"|"refund" }
 *   - mark_paid → IBAN/cash için "geldi" işareti
 *   - cancel → pending durumdaki iptal
 *   - refund → Mollie'de refund + DB refund kaydı
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { refundOtelPayment } from "@/platform/mollie/otel-payments";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body: any = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: payment } = await sb
    .from("otel_payments")
    .select("id, hotel_id, reservation_id, amount, status, provider, provider_payment_id, payment_type")
    .eq("id", id)
    .single();
  if (!payment) return NextResponse.json({ error: "Ödeme bulunamadı" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", payment.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  if (body.action === "mark_paid") {
    if (payment.provider === "mollie") {
      return NextResponse.json({ error: "Mollie ödemesi otomatik durum alır" }, { status: 400 });
    }
    if (payment.status === "paid") {
      return NextResponse.json({ success: true, payment_id: id, status: "paid" });
    }
    const { error } = await sb.from("otel_payments")
      .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, payment_id: id, status: "paid" });
  }

  if (body.action === "cancel") {
    if (payment.status === "paid") {
      return NextResponse.json({ error: "Ödenmiş ödeme iptal edilemez, iade kullanın" }, { status: 400 });
    }
    const { error } = await sb.from("otel_payments")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, payment_id: id, status: "canceled" });
  }

  if (body.action === "refund") {
    if (payment.status !== "paid") {
      return NextResponse.json({ error: "Sadece ödenmiş kayıt iade edilebilir" }, { status: 400 });
    }
    const amount = Number(body.amount || payment.amount);

    if (payment.provider === "mollie" && payment.provider_payment_id) {
      try {
        await refundOtelPayment(payment.provider_payment_id, amount);
      } catch (err: any) {
        return NextResponse.json({ error: `Mollie iade hatası: ${err?.message}` }, { status: 502 });
      }
    }

    // Refund kaydı (negatif olarak değil, payment_type='refund')
    const { data: refund, error: insErr } = await sb.from("otel_payments")
      .insert({
        reservation_id: payment.reservation_id,
        hotel_id: payment.hotel_id,
        amount,
        currency: "TRY",
        payment_type: "refund",
        status: "paid",
        provider: payment.provider,
        provider_payment_id: payment.provider_payment_id,
        paid_at: new Date().toISOString(),
        description: `İade — ödeme ${id.slice(0, 8)}`,
      })
      .select("id")
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    await sb.from("otel_payments")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ success: true, payment_id: id, refund_id: refund.id });
  }

  return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
}
