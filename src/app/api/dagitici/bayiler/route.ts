/**
 * GET /api/dagitici/bayiler — bayi listesi (filtre + sayfalama).
 *   query: q, segment, region, status (active/inactive/all), page, pageSize
 *
 * POST /api/dagitici/bayiler — yeni bayi.
 *   body: { name, contactName?, phone, email?, segment?, region?,
 *           address?, taxNo?, creditLimit?, paymentTermDays? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const segment = url.searchParams.get("segment") || "";
  const region = url.searchParams.get("region") || "";
  const statusParam = url.searchParams.get("status") || "active";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSizeRaw = parseInt(
    url.searchParams.get("pageSize") || `${PAGE_SIZE_DEFAULT}`,
    10,
  );
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, pageSizeRaw));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from("bayi_dealers")
    .select(
      "id, name, company_name, contact_name, phone, email, city, district, segment, region, balance, credit_limit, payment_term_days, risk_status, is_active, status, updated_at",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId);

  if (q) {
    // PostgREST or() — name, company_name, phone içinde arama
    const safe = q.replace(/[,()]/g, "");
    query = query.or(
      `name.ilike.%${safe}%,company_name.ilike.%${safe}%,phone.ilike.%${safe}%,contact_name.ilike.%${safe}%`,
    );
  }
  if (segment && ["A", "B", "C"].includes(segment)) {
    query = query.eq("segment", segment);
  }
  if (region) {
    query = query.eq("region", region);
  }
  if (statusParam === "active") {
    query = query.eq("is_active", true);
  } else if (statusParam === "inactive") {
    query = query.eq("is_active", false);
  }

  query = query.order("updated_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("[dagitici:bayiler:list]", error);
    return NextResponse.json({ error: "Liste yüklenemedi." }, { status: 500 });
  }

  const items = (data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.company_name as string) || (d.name as string),
    contactName: (d.contact_name as string) || null,
    phone: (d.phone as string) || "",
    email: (d.email as string) || null,
    city: (d.city as string) || null,
    district: (d.district as string) || null,
    segment: (d.segment as string) || null,
    region: (d.region as string) || null,
    balance: Number(d.balance ?? 0),
    creditLimit: d.credit_limit != null ? Number(d.credit_limit) : null,
    paymentTermDays: d.payment_term_days != null ? Number(d.payment_term_days) : null,
    riskStatus: (d.risk_status as string) || "clean",
    isActive: Boolean(d.is_active),
    updatedAt: d.updated_at as string,
  }));

  return NextResponse.json({
    success: true,
    items,
    total: count ?? items.length,
    page,
    pageSize,
  });
}

interface NewBayiBody {
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  segment?: string;
  region?: string;
  address?: string;
  taxNo?: string;
  creditLimit?: number | string;
  paymentTermDays?: number | string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewBayiBody;
  const name = (body.name || "").trim();
  const phone = (body.phone || "").trim();
  if (!name || !phone) {
    return NextResponse.json({ error: "İsim ve telefon zorunlu." }, { status: 400 });
  }
  if (body.segment && !["A", "B", "C"].includes(body.segment)) {
    return NextResponse.json({ error: "Segment A/B/C olmalı." }, { status: 400 });
  }

  const insertPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    name,
    company_name: name,
    contact_name: body.contactName?.trim() || null,
    phone,
    email: body.email?.trim() || null,
    address: body.address?.trim() || null,
    tax_no: body.taxNo?.trim() || null,
    segment: body.segment || null,
    region: body.region?.trim() || null,
    credit_limit:
      body.creditLimit != null && body.creditLimit !== ""
        ? Number(body.creditLimit)
        : null,
    payment_term_days:
      body.paymentTermDays != null && body.paymentTermDays !== ""
        ? Number(body.paymentTermDays)
        : null,
    is_active: true,
    status: "active",
  };

  const { data, error } = await sb
    .from("bayi_dealers")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    console.error("[dagitici:bayiler:create]", error);
    const msg = error.message?.includes("duplicate")
      ? "Bu telefon başka bir bayide kayıtlı."
      : "Bayi kaydedilemedi.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data!.id });
}
