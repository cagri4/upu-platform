/**
 * GET /api/urunler/[id] — ürün detayı.
 *
 * Magic-link auth (token query param). Sahip-only — başka tenant'ın
 * ürününü açamasın.
 *
 * Response: ürün temel bilgileri + son siparişler (bu ürünü içeren
 * order_items üzerinden) + bağlı bayilere mini özet.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

interface RouteCtx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;

  const { data: product, error: pErr } = await supabase
    .from("bayi_products")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();
  if (pErr) {
    return NextResponse.json({ error: "Ürün sorgusu başarısız", details: pErr.message }, { status: 500 });
  }
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  // Bu ürünü içeren son sipariş kalemleri (max 10)
  const { data: orderItems } = await supabase
    .from("bayi_order_items")
    .select("order_id, quantity, unit_price, total_price, product_name")
    .eq("product_id", id)
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const orderIds = Array.from(new Set((orderItems || []).map((it: { order_id: string }) => it.order_id)));
  const safeIds = orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"];

  const { data: orders } = await supabase
    .from("bayi_orders")
    .select("id, order_number, dealer_id, total_amount, created_at, status_id")
    .in("id", safeIds)
    .order("created_at", { ascending: false });

  const dealerIds = Array.from(new Set((orders || []).map((o: { dealer_id: string }) => o.dealer_id)));
  const { data: dealers } = await supabase
    .from("bayi_dealers")
    .select("id, name, company_name")
    .in("id", dealerIds.length ? dealerIds : ["00000000-0000-0000-0000-000000000000"]);
  const dealerMap = new Map((dealers || []).map((d: { id: string; name: string; company_name: string }) => [d.id, d.name || d.company_name]));

  const stk = Number(product.stock_quantity) || 0;
  const low = Number(product.low_stock_threshold) || 10;
  let stockStatus: "out" | "critical" | "ok" = "ok";
  if (stk === 0) stockStatus = "out";
  else if (stk <= low) stockStatus = "critical";

  return NextResponse.json({
    product: {
      id: product.id,
      code: product.code || product.sku || "",
      name: product.name || "—",
      description: product.description || null,
      brand: product.brand || null,
      category: product.category || null,
      unit: product.unit || "adet",
      basePrice: Number(product.base_price) || 0,
      unitPrice: Number(product.unit_price) || Number(product.base_price) || 0,
      stockQuantity: stk,
      lowStockThreshold: low,
      stockStatus,
      minOrder: Number(product.min_order) || 1,
      imageUrl: product.image_url || null,
      barcode: product.barcode || null,
      weight: Number(product.weight) || 0,
      vatRate: (product.specs as { vat_rate?: number } | null)?.vat_rate ?? null,
    },
    recentOrders: (orderItems || []).slice(0, 10).map((it: { order_id: string; quantity: number; unit_price: number; total_price: number }) => {
      const order = (orders || []).find((o: { id: string }) => o.id === it.order_id);
      return {
        orderId: it.order_id,
        orderNumber: order?.order_number,
        dealerName: order ? dealerMap.get(order.dealer_id) || "—" : "—",
        quantity: Number(it.quantity) || 0,
        unitPrice: Number(it.unit_price) || 0,
        totalPrice: Number(it.total_price) || 0,
        createdAt: order?.created_at,
      };
    }),
  });
}
