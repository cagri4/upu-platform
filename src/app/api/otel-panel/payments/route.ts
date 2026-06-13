/**
 * /api/otel-panel/payments — Otel ödeme listesi + oluştur (Faz 4)
 *
 * GET: tüm ödemeler (rez join'li)
 * POST body: { reservation_id, amount, payment_type, provider, description?, send_to_guest? }
 *   - provider='mollie' → Mollie payment + checkout URL döner
 *   - provider='manual_iban' → IBAN takibine düşen pending kayıt
 *   - provider='cash' → direkt paid status kaydı
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { createOtelPayment } from "@/platform/mollie/otel-payments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, payments: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, payments: [] });

  const { data: payments } = await sb
    .from("otel_payments")
    .select("id, reservation_id, amount, currency, payment_type, status, provider, provider_payment_id, checkout_url, paid_at, description, created_at, otel_reservations(guest_name, check_in, check_out)")
    .in("hotel_id", hotelIds)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ success: true, payments: payments || [] });
}

interface PostBody {
  reservation_id?: string;
  amount?: number;
  payment_type?: "deposit" | "full" | "partial";
  provider?: "mollie" | "manual_iban" | "cash";
  description?: string;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: PostBody = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  if (!body.reservation_id || !body.amount || !body.payment_type) {
    return NextResponse.json({ error: "reservation_id, amount, payment_type zorunlu" }, { status: 400 });
  }
  if (body.amount <= 0) return NextResponse.json({ error: "Tutar 0'dan büyük olmalı" }, { status: 400 });

  const provider = body.provider || "mollie";
  if (!["mollie", "manual_iban", "cash"].includes(provider)) {
    return NextResponse.json({ error: "Geçersiz provider" }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: rez } = await sb
    .from("otel_reservations")
    .select("id, hotel_id, guest_name, guest_email, otel_hotels(slug)")
    .eq("id", body.reservation_id)
    .single();
  if (!rez) return NextResponse.json({ error: "Rezervasyon bulunamadı" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", rez.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  // Pending kayıt
  const initialStatus = provider === "cash" ? "paid" : "pending";
  const initialPaidAt = provider === "cash" ? new Date().toISOString() : null;

  const { data: created, error } = await sb
    .from("otel_payments")
    .insert({
      reservation_id: rez.id,
      hotel_id: rez.hotel_id,
      amount: body.amount,
      currency: "TRY",
      payment_type: body.payment_type,
      status: initialStatus,
      provider,
      paid_at: initialPaidAt,
      description: body.description || `${body.payment_type === "deposit" ? "Kapora" : "Konaklama"} ödeme — ${rez.guest_name}`,
    })
    .select("id, amount, payment_type, status, provider")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mollie ise checkout link oluştur
  if (provider === "mollie") {
    try {
      const slug = (rez.otel_hotels as any)?.slug || "otel";
      const m = await createOtelPayment({
        paymentId: created.id,
        reservationId: rez.id,
        slug,
        amount: body.amount,
        description: body.description || `Otel ödemesi - ${rez.guest_name}`,
        guestEmail: rez.guest_email || undefined,
      });
      const checkoutUrl = m._links?.checkout?.href || null;
      await sb.from("otel_payments")
        .update({
          provider_payment_id: m.id,
          checkout_url: checkoutUrl,
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", created.id);
      return NextResponse.json({
        success: true,
        payment_id: created.id,
        provider: "mollie",
        checkout_url: checkoutUrl,
        mollie_id: m.id,
      });
    } catch (err: any) {
      await sb.from("otel_payments")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", created.id);
      return NextResponse.json({
        error: `Mollie hatası: ${err?.message || "bilinmiyor"}`,
      }, { status: 502 });
    }
  }

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({
    success: true,
    payment_id: created.id,
    provider,
    status: initialStatus,
  });
}
