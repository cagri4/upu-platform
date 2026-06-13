/**
 * /api/otel-panel/invoices — e-Fatura/e-Arşiv liste + oluştur (Faz 4)
 *
 * GET: tüm faturalar
 * POST body: { reservation_id, invoice_type, customer_vkn, customer_name, ... }
 *   Mock entegratör'e gönderir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { submitInvoiceMock, type InvoicePayload } from "@/platform/efatura/mock-client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, invoices: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, invoices: [] });

  const { data: invoices } = await sb
    .from("otel_invoices")
    .select("id, reservation_id, invoice_type, status, invoice_number, invoice_uuid, pdf_url, total_amount, is_mock, error_message, sent_at, accepted_at, created_at, otel_reservations(guest_name, check_in, check_out)")
    .in("hotel_id", hotelIds)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ success: true, invoices: invoices || [] });
}

interface PostBody {
  reservation_id?: string;
  invoice_type?: "e_fatura" | "e_arsiv";
  customer_name?: string;
  customer_vkn_or_tckn?: string;
  customer_email?: string;
  customer_address?: string;
  total_amount?: number;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: PostBody = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  if (!body.reservation_id || !body.customer_name || !body.total_amount) {
    return NextResponse.json({ error: "reservation_id, customer_name, total_amount zorunlu" }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: rez } = await sb
    .from("otel_reservations")
    .select("id, hotel_id, guest_name, check_in, check_out, total_price")
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

  const invoiceType = body.invoice_type || "e_arsiv";
  const total = Number(body.total_amount);

  // Single item: konaklama bedeli
  const payload: InvoicePayload = {
    invoice_type: invoiceType,
    customer: {
      name: body.customer_name,
      vkn_or_tckn: body.customer_vkn_or_tckn || null,
      email: body.customer_email || null,
      address: body.customer_address || null,
    },
    items: [{
      description: `Konaklama: ${rez.check_in} - ${rez.check_out}`,
      quantity: 1,
      unit_price: total / 1.08,    // KDV %8 hariç
      vat_rate: 8,
    }],
    total,
    currency: "TRY",
    reservation_ref: rez.id,
  };

  // DB draft kayıt
  const { data: created, error: insErr } = await sb
    .from("otel_invoices")
    .insert({
      reservation_id: rez.id,
      hotel_id: rez.hotel_id,
      invoice_type: invoiceType,
      status: "draft",
      payload,
      total_amount: total,
      is_mock: true,
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Mock'a gönder
  const result = await submitInvoiceMock(payload);

  const now = new Date().toISOString();
  await sb.from("otel_invoices").update({
    status: result.status,
    invoice_uuid: result.invoice_uuid,
    invoice_number: result.invoice_number,
    pdf_url: result.pdf_url,
    integrator_response: result.raw_response,
    error_message: result.error_message,
    sent_at: now,
    accepted_at: result.status === "accepted" ? now : null,
    updated_at: now,
  }).eq("id", created.id);

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: now })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({
    success: true,
    invoice_id: created.id,
    status: result.status,
    invoice_number: result.invoice_number,
    invoice_uuid: result.invoice_uuid,
    pdf_url: result.pdf_url,
    error_message: result.error_message,
  });
}
