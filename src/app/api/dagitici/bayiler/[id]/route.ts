/**
 * GET    /api/dagitici/bayiler/[id] — bayi detayı + son siparişler
 * PUT    /api/dagitici/bayiler/[id] — alanları güncelle
 * DELETE /api/dagitici/bayiler/[id] — soft delete (is_active=false)
 *
 * Tenant guard: her query .eq("tenant_id", tenantId) zorunlu — başka tenant
 * bayisi getter'la sızmasın.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await ctx.params;

  const { data: dealer, error } = await sb
    .from("bayi_dealers")
    .select(
      "id, name, company_name, contact_name, phone, email, address, city, district, tax_no, tax_number, tax_office, iban, segment, region, balance, credit_limit, payment_term_days, discount_rate, risk_status, is_active, status, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (error || !dealer) {
    return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });
  }

  // Son 10 sipariş
  const { data: orders } = await sb
    .from("bayi_orders")
    .select(
      "id, order_number, total_amount, status_id, created_at, bayi_order_statuses(code, name)",
    )
    .eq("tenant_id", tenantId)
    .eq("dealer_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const recentOrders = (orders ?? []).map((o) => {
    const status = (o as { bayi_order_statuses?: { code?: string; name?: string } | null }).bayi_order_statuses;
    return {
      id: o.id as string,
      orderNumber: o.order_number as string,
      totalAmount: Number(o.total_amount ?? 0),
      statusCode: status?.code || "unknown",
      statusName: status?.name || "—",
      createdAt: o.created_at as string,
    };
  });

  return NextResponse.json({
    success: true,
    dealer: {
      id: dealer.id as string,
      name: (dealer.company_name as string) || (dealer.name as string),
      contactName: (dealer.contact_name as string) || null,
      phone: (dealer.phone as string) || "",
      email: (dealer.email as string) || null,
      address: (dealer.address as string) || null,
      city: (dealer.city as string) || null,
      district: (dealer.district as string) || null,
      taxNo: (dealer.tax_number as string) || (dealer.tax_no as string) || null,
      taxOffice: (dealer.tax_office as string) || null,
      iban: (dealer.iban as string) || null,
      segment: (dealer.segment as string) || null,
      region: (dealer.region as string) || null,
      balance: Number(dealer.balance ?? 0),
      creditLimit: dealer.credit_limit != null ? Number(dealer.credit_limit) : null,
      paymentTermDays: dealer.payment_term_days != null ? Number(dealer.payment_term_days) : null,
      discountRate: dealer.discount_rate != null ? Number(dealer.discount_rate) : null,
      riskStatus: (dealer.risk_status as string) || "clean",
      isActive: Boolean(dealer.is_active),
      createdAt: dealer.created_at as string,
      updatedAt: dealer.updated_at as string,
    },
    recentOrders,
  });
}

interface UpdateBody {
  name?: string;
  contactName?: string | null;
  phone?: string;
  email?: string | null;
  address?: string | null;
  taxNo?: string | null;
  segment?: string | null;
  region?: string | null;
  creditLimit?: number | string | null;
  paymentTermDays?: number | string | null;
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  if (body.segment && !["A", "B", "C"].includes(body.segment)) {
    return NextResponse.json({ error: "Segment A/B/C olmalı." }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n) return NextResponse.json({ error: "İsim boş olamaz." }, { status: 400 });
    updates.name = n;
    updates.company_name = n;
  }
  if (body.contactName !== undefined) updates.contact_name = body.contactName?.trim() || null;
  if (body.phone !== undefined) {
    const p = body.phone.trim();
    if (!p) return NextResponse.json({ error: "Telefon boş olamaz." }, { status: 400 });
    updates.phone = p;
  }
  if (body.email !== undefined) updates.email = body.email?.trim() || null;
  if (body.address !== undefined) updates.address = body.address?.trim() || null;
  if (body.taxNo !== undefined) {
    const v = body.taxNo?.trim() || null;
    updates.tax_no = v;
    updates.tax_number = v;
  }
  if (body.segment !== undefined) updates.segment = body.segment || null;
  if (body.region !== undefined) updates.region = body.region?.trim() || null;
  if (body.creditLimit !== undefined) {
    updates.credit_limit =
      body.creditLimit == null || body.creditLimit === "" ? null : Number(body.creditLimit);
  }
  if (body.paymentTermDays !== undefined) {
    updates.payment_term_days =
      body.paymentTermDays == null || body.paymentTermDays === ""
        ? null
        : Number(body.paymentTermDays);
  }

  const { data, error } = await sb
    .from("bayi_dealers")
    .update(updates)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[dagitici:bayiler:update]", error);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await ctx.params;

  // Soft delete — is_active=false, status='inactive'. Sipariş geçmişi ve
  // ekstre kaydı koruma. Hard delete admin-panel'den yapılır.
  const { data, error } = await sb
    .from("bayi_dealers")
    .update({
      is_active: false,
      status: "inactive",
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[dagitici:bayiler:delete]", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
