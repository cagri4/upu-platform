/**
 * GET /api/dagitici/siparisler — sipariş kuyruğu (filtre + sayfalama).
 *   query: q (order_number/dealer_name), status, dealer_id, from, to, page, pageSize
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;
const STATUSES = [
  "pending",
  "approved",
  "rejected",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const status = url.searchParams.get("status") || "";
  const dealerId = url.searchParams.get("dealer_id") || "";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSizeRaw = parseInt(
    url.searchParams.get("pageSize") || `${PAGE_SIZE_DEFAULT}`,
    10,
  );
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, pageSizeRaw));
  const rangeFrom = (page - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  let query = sb
    .from("bayi_orders")
    .select(
      "id, order_number, dealer_id, status, subtotal, discount_amount, total_amount, approved_at, rejected_at, reject_reason, coupon_code, notes, created_at, updated_at, bayi_dealers(name, company_name, segment)",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId);

  if (q) {
    const safe = q.replace(/[,()]/g, "");
    query = query.ilike("order_number", `%${safe}%`);
  }
  if (status && STATUSES.includes(status)) {
    query = query.eq("status", status);
  }
  if (dealerId) query = query.eq("dealer_id", dealerId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59");

  // Pending önce, sonra yeni
  query = query
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  const { data, count, error } = await query;
  if (error) {
    console.error("[dagitici:siparisler:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const items = (data ?? []).map((o) => {
    const dealersRaw = o.bayi_dealers as unknown;
    const dealerArr = Array.isArray(dealersRaw) ? dealersRaw : dealersRaw ? [dealersRaw] : [];
    const d = (dealerArr[0] ?? null) as
      | { name: string; company_name: string; segment: string | null }
      | null;
    return {
      id: o.id as string,
      orderNumber: (o.order_number as string) || "",
      dealerId: (o.dealer_id as string) || null,
      dealerName: d ? (d.company_name || d.name) : "—",
      dealerSegment: d?.segment || null,
      status: (o.status as string) || "pending",
      subtotal: Number(o.subtotal ?? 0),
      discountAmount: Number(o.discount_amount ?? 0),
      totalAmount: Number(o.total_amount ?? 0),
      approvedAt: (o.approved_at as string) || null,
      rejectedAt: (o.rejected_at as string) || null,
      rejectReason: (o.reject_reason as string) || null,
      couponCode: (o.coupon_code as string) || null,
      notes: (o.notes as string) || null,
      createdAt: o.created_at as string,
      updatedAt: o.updated_at as string,
    };
  });

  return NextResponse.json({
    success: true,
    items,
    total: count ?? items.length,
    page,
    pageSize,
  });
}
