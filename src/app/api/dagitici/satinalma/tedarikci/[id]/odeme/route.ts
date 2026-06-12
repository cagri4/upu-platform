/**
 * POST /api/dagitici/satinalma/tedarikci/[id]/odeme — tedarikçiye ödeme kaydı (cari mahsup).
 *   body: { amount, method?, note?, po_id? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../../_auth";

export const dynamic = "force-dynamic";

const MAX_AMOUNT = 1_000_000_000;

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PaymentBody {
  amount?: number | string;
  method?: string;
  note?: string;
  po_id?: string;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;
  const { id } = await params;

  const { data: sup } = await sb
    .from("bayi_suppliers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!sup) return NextResponse.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PaymentBody;
  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Geçerli tutar gir (>0)." }, { status: 400 });
  }
  if (amount > MAX_AMOUNT) {
    return NextResponse.json({ error: "Tutar çok yüksek." }, { status: 400 });
  }

  // PO opsiyonel — verildiyse tenant + supplier doğrula
  let poId: string | null = null;
  if (body.po_id) {
    const { data: po } = await sb
      .from("bayi_purchase_orders")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("supplier_id", id)
      .eq("id", body.po_id)
      .maybeSingle();
    if (po) poId = po.id as string;
  }

  const { data, error } = await sb
    .from("bayi_supplier_payments")
    .insert({
      tenant_id: tenantId,
      supplier_id: id,
      po_id: poId,
      amount: +amount.toFixed(2),
      method: body.method?.trim() || null,
      note: body.note?.trim() || null,
      created_by: profileId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[dagitici:satinalma:odeme]", error);
    return NextResponse.json({ error: "Ödeme kaydedilemedi." }, { status: 400 });
  }
  return NextResponse.json({ success: true, id: data.id });
}
