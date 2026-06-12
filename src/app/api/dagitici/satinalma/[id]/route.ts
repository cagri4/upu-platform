/**
 * GET   /api/dagitici/satinalma/[id] — PO detayı (satırlar + tedarikçi + gelen adetler).
 * PATCH /api/dagitici/satinalma/[id] — durum geçişi (draft→sent, →closed) veya not.
 *   body: { status?: 'sent'|'closed', note? }
 *
 * Geçerli geçişler: draft→sent (sent_at damgası), sent/partial/received→closed.
 * 'partial'/'received' mal kabul ile otomatik atanır (bkz. mal-kabul route).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: po } = await sb
    .from("bayi_purchase_orders")
    .select("id, po_number, supplier_id, status, expected_date, subtotal, total_amount, note, sent_at, created_at, bayi_suppliers(name, contact_name, contact_phone, payment_term_days)")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!po) return NextResponse.json({ error: "PO bulunamadı." }, { status: 404 });

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  const { data: lines } = await sb
    .from("bayi_purchase_order_lines")
    .select("id, product_id, quantity, received_qty, unit_price, line_total, bayi_products(code, name)")
    .eq("tenant_id", tenantId)
    .eq("po_id", id)
    .order("created_at", { ascending: true });

  const sup = pick(po.bayi_suppliers);

  return NextResponse.json({
    success: true,
    po: {
      id: po.id as string,
      poNumber: po.po_number as string,
      supplierId: po.supplier_id as string,
      supplierName: (sup?.name as string) || "Tedarikçi",
      supplierContact: (sup?.contact_name as string) || null,
      supplierPhone: (sup?.contact_phone as string) || null,
      paymentTermDays: Number(sup?.payment_term_days) || 0,
      status: po.status as string,
      expectedDate: (po.expected_date as string) || null,
      subtotal: Number(po.subtotal ?? 0),
      total: Number(po.total_amount ?? 0),
      note: (po.note as string) || null,
      sentAt: (po.sent_at as string) || null,
      createdAt: po.created_at as string,
    },
    lines: (lines ?? []).map((l) => ({
      id: l.id as string,
      productId: l.product_id as string,
      productCode: (pick(l.bayi_products)?.code as string) || "",
      productName: (pick(l.bayi_products)?.name as string) || "(ürün)",
      quantity: Number(l.quantity) || 0,
      receivedQty: Number(l.received_qty) || 0,
      remaining: Math.max(0, Number(l.quantity) - Number(l.received_qty)),
      unitPrice: Number(l.unit_price) || 0,
      lineTotal: Number(l.line_total) || 0,
    })),
  });
}

interface PatchBody {
  status?: string;
  note?: string;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: po } = await sb
    .from("bayi_purchase_orders")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!po) return NextResponse.json({ error: "PO bulunamadı." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const cur = po.status as string;

  if (typeof body.note === "string") patch.note = body.note.trim() || null;

  if (typeof body.status === "string") {
    const next = body.status;
    const allowed =
      (cur === "draft" && next === "sent") ||
      (["sent", "partial", "received"].includes(cur) && next === "closed");
    if (!allowed) {
      return NextResponse.json(
        { error: `Geçersiz durum geçişi (${cur} → ${next}).` },
        { status: 400 },
      );
    }
    patch.status = next;
    if (next === "sent") patch.sent_at = new Date().toISOString();
  }

  await sb.from("bayi_purchase_orders").update(patch).eq("tenant_id", tenantId).eq("id", id);
  return NextResponse.json({ success: true });
}
