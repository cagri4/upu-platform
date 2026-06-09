/**
 * GET /api/bayi/siparisler — bayinin kendi siparişleri (filtre + sayfalama).
 *   query: status, from, to, page, pageSize
 *
 * Dağıtıcı endpoint'i ile aynı şema ama dealer scope zorunlu.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;
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
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  // Dealer şart
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!dealer) {
    return NextResponse.json({
      success: true,
      items: [],
      total: 0,
      page: 1,
      pageSize: PAGE_SIZE_DEFAULT,
      message: "Bayi hesabı yok.",
    });
  }
  const dealerId = dealer.id as string;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "";
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
      "id, order_number, status, subtotal, discount_amount, total_amount, coupon_code, approved_at, rejected_at, reject_reason, created_at",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .eq("dealer_id", dealerId);

  if (status && STATUSES.includes(status)) {
    query = query.eq("status", status);
  }
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to + "T23:59:59");

  query = query
    .order("created_at", { ascending: false })
    .range(rangeFrom, rangeTo);

  const { data, count, error } = await query;
  if (error) {
    console.error("[bayi:siparisler:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const items = (data ?? []).map((o) => ({
    id: o.id as string,
    orderNumber: (o.order_number as string) || "",
    status: (o.status as string) || "pending",
    subtotal: Number(o.subtotal ?? 0),
    discountAmount: Number(o.discount_amount ?? 0),
    totalAmount: Number(o.total_amount ?? 0),
    couponCode: (o.coupon_code as string) || null,
    approvedAt: (o.approved_at as string) || null,
    rejectedAt: (o.rejected_at as string) || null,
    rejectReason: (o.reject_reason as string) || null,
    createdAt: o.created_at as string,
  }));

  return NextResponse.json({
    success: true,
    items,
    total: count ?? items.length,
    page,
    pageSize,
  });
}
