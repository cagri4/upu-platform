/**
 * GET  /api/dagitici/satinalma/tedarikci — tedarikçi listesi (+cari özet).
 * POST /api/dagitici/satinalma/tedarikci — yeni tedarikçi.
 *   body: { name, tax_no?, address?, contact_name?, contact_phone?, contact_email?, payment_term_days? }
 *
 * Cari özet: borç = non-draft PO toplamları, ödenen = supplier_payments
 * toplamı, kalan = borç − ödenen (aggregate, ayrı cari tablosu yok).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

const MAX_TERM_DAYS = 3650;

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const { data: suppliers, error } = await sb
    .from("bayi_suppliers")
    .select("id, name, tax_no, contact_name, contact_phone, payment_term_days, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });
  if (error) {
    console.error("[dagitici:satinalma:tedarikci:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const ids = (suppliers ?? []).map((s) => s.id as string);
  const debt = new Map<string, number>();
  const paid = new Map<string, number>();
  if (ids.length > 0) {
    const { data: pos } = await sb
      .from("bayi_purchase_orders")
      .select("supplier_id, total_amount, status")
      .eq("tenant_id", tenantId)
      .in("supplier_id", ids)
      .neq("status", "draft");
    for (const p of pos ?? []) {
      const sid = p.supplier_id as string;
      debt.set(sid, (debt.get(sid) ?? 0) + Number(p.total_amount ?? 0));
    }
    const { data: pays } = await sb
      .from("bayi_supplier_payments")
      .select("supplier_id, amount")
      .eq("tenant_id", tenantId)
      .in("supplier_id", ids);
    for (const p of pays ?? []) {
      const sid = p.supplier_id as string;
      paid.set(sid, (paid.get(sid) ?? 0) + Number(p.amount ?? 0));
    }
  }

  return NextResponse.json({
    success: true,
    items: (suppliers ?? []).map((s) => {
      const sid = s.id as string;
      const borc = debt.get(sid) ?? 0;
      const odenen = paid.get(sid) ?? 0;
      return {
        id: sid,
        name: s.name as string,
        taxNo: (s.tax_no as string) || null,
        contactName: (s.contact_name as string) || null,
        contactPhone: (s.contact_phone as string) || null,
        paymentTermDays: Number(s.payment_term_days) || 0,
        isActive: Boolean(s.is_active),
        debt: borc,
        paid: odenen,
        balance: +(borc - odenen).toFixed(2),
      };
    }),
  });
}

interface NewSupplierBody {
  name?: string;
  tax_no?: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  payment_term_days?: number | string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewSupplierBody;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Tedarikçi adı zorunlu." }, { status: 400 });
  }
  let term = body.payment_term_days != null && body.payment_term_days !== "" ? Math.floor(Number(body.payment_term_days)) : 0;
  if (!Number.isFinite(term) || term < 0 || term > MAX_TERM_DAYS) term = 0;

  const { data, error } = await sb
    .from("bayi_suppliers")
    .insert({
      tenant_id: tenantId,
      name,
      tax_no: body.tax_no?.trim() || null,
      address: body.address?.trim() || null,
      contact_name: body.contact_name?.trim() || null,
      contact_phone: body.contact_phone?.trim() || null,
      contact_email: body.contact_email?.trim() || null,
      payment_term_days: term,
      is_active: true,
      created_by: profileId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[dagitici:satinalma:tedarikci:create]", error);
    return NextResponse.json({ error: "Oluşturulamadı." }, { status: 400 });
  }
  return NextResponse.json({ success: true, id: data.id });
}
