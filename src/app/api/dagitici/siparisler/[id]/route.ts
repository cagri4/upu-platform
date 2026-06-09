/**
 * GET /api/dagitici/siparisler/[id] — sipariş detay + kalemler + status history.
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

  const { data: o, error } = await sb
    .from("bayi_orders")
    .select(
      "id, order_number, dealer_id, status, subtotal, discount_amount, total_amount, approved_at, rejected_at, reject_reason, approved_by_profile_id, coupon_code, notes, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[dagitici:siparisler:get]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }
  if (!o) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  // Dealer
  let dealer: {
    id: string;
    name: string;
    contactName: string | null;
    phone: string;
    email: string | null;
    segment: string | null;
    region: string | null;
  } | null = null;
  if (o.dealer_id) {
    const { data: d } = await sb
      .from("bayi_dealers")
      .select("id, name, company_name, contact_name, phone, email, segment, region")
      .eq("tenant_id", tenantId)
      .eq("id", o.dealer_id)
      .maybeSingle();
    if (d) {
      dealer = {
        id: d.id as string,
        name: (d.company_name as string) || (d.name as string),
        contactName: (d.contact_name as string) || null,
        phone: (d.phone as string) || "",
        email: (d.email as string) || null,
        segment: (d.segment as string) || null,
        region: (d.region as string) || null,
      };
    }
  }

  // Kalemler
  const { data: items } = await sb
    .from("bayi_order_items")
    .select(
      "id, product_id, product_code, product_name, quantity, unit_price, line_discount, total_price, campaign_id",
    )
    .eq("tenant_id", tenantId)
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const campaignIds = Array.from(
    new Set(
      (items ?? [])
        .map((it) => it.campaign_id as string | null)
        .filter((x): x is string => !!x),
    ),
  );
  const campaignNames = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: camps } = await sb
      .from("bayi_campaigns")
      .select("id, title")
      .eq("tenant_id", tenantId)
      .in("id", campaignIds);
    (camps ?? []).forEach((c) =>
      campaignNames.set(c.id as string, c.title as string),
    );
  }

  // Status history
  const { data: history } = await sb
    .from("bayi_order_status_history")
    .select("id, from_status, to_status, reason, created_at, changed_by_profile_id")
    .eq("tenant_id", tenantId)
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    success: true,
    order: {
      id: o.id as string,
      orderNumber: (o.order_number as string) || "",
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
    },
    dealer,
    items: (items ?? []).map((it) => ({
      id: it.id as string,
      productId: (it.product_id as string) || null,
      productCode: (it.product_code as string) || "",
      productName: (it.product_name as string) || "",
      quantity: Number(it.quantity ?? 0),
      unitPrice: Number(it.unit_price ?? 0),
      lineDiscount: Number(it.line_discount ?? 0),
      totalPrice: Number(it.total_price ?? 0),
      campaignId: (it.campaign_id as string) || null,
      campaignName: it.campaign_id
        ? campaignNames.get(it.campaign_id as string) || null
        : null,
    })),
    history: (history ?? []).map((h) => ({
      id: h.id as string,
      fromStatus: (h.from_status as string) || null,
      toStatus: h.to_status as string,
      reason: (h.reason as string) || null,
      createdAt: h.created_at as string,
      changedByProfileId: (h.changed_by_profile_id as string) || null,
    })),
  });
}
