/**
 * GET   /api/dagitici/satinalma/tedarikci/[id] — tedarikçi detayı + cari ekstre.
 * PATCH /api/dagitici/satinalma/tedarikci/[id] — güncelle (whitelist).
 *
 * Cari ekstre: PO'lar (borç) + ödemeler birleşik kronolojik hareket listesi +
 * özet (borç/ödenen/kalan).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";

export const dynamic = "force-dynamic";

const MAX_TERM_DAYS = 3650;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: sup } = await sb
    .from("bayi_suppliers")
    .select("id, name, tax_no, address, contact_name, contact_phone, contact_email, payment_term_days, is_active")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!sup) return NextResponse.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });

  const { data: pos } = await sb
    .from("bayi_purchase_orders")
    .select("id, po_number, status, total_amount, expected_date, created_at")
    .eq("tenant_id", tenantId)
    .eq("supplier_id", id)
    .order("created_at", { ascending: false });

  const { data: pays } = await sb
    .from("bayi_supplier_payments")
    .select("id, amount, method, note, paid_at")
    .eq("tenant_id", tenantId)
    .eq("supplier_id", id)
    .order("paid_at", { ascending: false });

  const debt = (pos ?? [])
    .filter((p) => p.status !== "draft")
    .reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  // Birleşik kronolojik hareket (ekstre)
  const ledger = [
    ...(pos ?? []).filter((p) => p.status !== "draft").map((p) => ({
      type: "debt" as const,
      date: p.created_at as string,
      label: `PO #${p.po_number}`,
      amount: Number(p.total_amount ?? 0),
      ref: p.id as string,
    })),
    ...(pays ?? []).map((p) => ({
      type: "payment" as const,
      date: p.paid_at as string,
      label: `Ödeme${p.method ? ` (${p.method})` : ""}`,
      amount: Number(p.amount ?? 0),
      ref: p.id as string,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return NextResponse.json({
    success: true,
    supplier: {
      id: sup.id as string,
      name: sup.name as string,
      taxNo: (sup.tax_no as string) || null,
      address: (sup.address as string) || null,
      contactName: (sup.contact_name as string) || null,
      contactPhone: (sup.contact_phone as string) || null,
      contactEmail: (sup.contact_email as string) || null,
      paymentTermDays: Number(sup.payment_term_days) || 0,
      isActive: Boolean(sup.is_active),
    },
    summary: { debt: +debt.toFixed(2), paid: +paid.toFixed(2), balance: +(debt - paid).toFixed(2) },
    orders: (pos ?? []).map((p) => ({
      id: p.id as string,
      poNumber: p.po_number as string,
      status: p.status as string,
      total: Number(p.total_amount ?? 0),
      expectedDate: (p.expected_date as string) || null,
      createdAt: p.created_at as string,
    })),
    payments: (pays ?? []).map((p) => ({
      id: p.id as string,
      amount: Number(p.amount ?? 0),
      method: (p.method as string) || null,
      note: (p.note as string) || null,
      paidAt: p.paid_at as string,
    })),
    ledger,
  });
}

interface PatchBody {
  name?: string;
  tax_no?: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  payment_term_days?: number | string;
  is_active?: boolean;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: sup } = await sb
    .from("bayi_suppliers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!sup) return NextResponse.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.tax_no === "string") patch.tax_no = body.tax_no.trim() || null;
  if (typeof body.address === "string") patch.address = body.address.trim() || null;
  if (typeof body.contact_name === "string") patch.contact_name = body.contact_name.trim() || null;
  if (typeof body.contact_phone === "string") patch.contact_phone = body.contact_phone.trim() || null;
  if (typeof body.contact_email === "string") patch.contact_email = body.contact_email.trim() || null;
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (body.payment_term_days != null && body.payment_term_days !== "") {
    const t = Math.floor(Number(body.payment_term_days));
    if (Number.isFinite(t) && t >= 0 && t <= MAX_TERM_DAYS) patch.payment_term_days = t;
  }

  await sb.from("bayi_suppliers").update(patch).eq("tenant_id", tenantId).eq("id", id);
  return NextResponse.json({ success: true });
}
