/**
 * GET /api/bayi/home — bayi ana sayfası aggregated veri.
 *
 * Tek istekte döner:
 *   - Bu bayiye uygun aktif kampanyalar (hedeflemeye göre)
 *   - Son 5 sipariş (özet)
 *   - Sık siparişlenen 8 ürün (geçmişe göre — yoksa yeni gelen ürünler)
 *   - Favori ürün id'leri (Faz 2 — bayi_favorites tablosu Sprint B'de)
 *
 * Performans: tek round-trip. Bayi panel ana sayfası ağır olmasın.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

interface CampaignLite {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  startDate: string;
  endDate: string;
  couponCode: string | null;
}

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  // 1) Bayinin kendi dealer kaydı (segment + region — kampanya hedefleme)
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id, segment, region")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  const dealerId = (dealer?.id as string) || null;
  const dealerSegment = (dealer?.segment as string) || null;
  const dealerRegion = (dealer?.region as string) || null;
  const today = new Date().toISOString().slice(0, 10);

  // 2) Aktif kampanyalar (tarih aralığında + status='active')
  const { data: rawCamps } = await sb
    .from("bayi_campaigns")
    .select("id, title, description, type, start_date, end_date, coupon_code")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("end_date", { ascending: true });

  const campIds = (rawCamps ?? []).map((c) => c.id as string);
  let campaigns: CampaignLite[] = [];

  if (campIds.length > 0) {
    // Hedeflemeyi çek, bu bayiye uyanları seç
    const { data: targets } = await sb
      .from("bayi_campaign_targets")
      .select("campaign_id, target_type, target_value")
      .eq("tenant_id", tenantId)
      .in("campaign_id", campIds);
    const targetsByCampaign = new Map<string, Array<{ type: string; value: string | null }>>();
    (targets ?? []).forEach((t) => {
      const k = t.campaign_id as string;
      const arr = targetsByCampaign.get(k) ?? [];
      arr.push({
        type: t.target_type as string,
        value: (t.target_value as string) || null,
      });
      targetsByCampaign.set(k, arr);
    });
    const matchesTargeting = (campId: string) => {
      const ts = targetsByCampaign.get(campId) ?? [];
      if (ts.length === 0) return false;
      return ts.some((t) => {
        if (t.type === "all") return true;
        if (t.type === "segment" && t.value === dealerSegment) return true;
        if (t.type === "region" && t.value === dealerRegion) return true;
        if (t.type === "dealer" && t.value === dealerId) return true;
        return false;
      });
    };
    campaigns = (rawCamps ?? [])
      .filter((c) => matchesTargeting(c.id as string))
      .map((c) => ({
        id: c.id as string,
        title: c.title as string,
        description: (c.description as string) || null,
        type: (c.type as string) || null,
        startDate: c.start_date as string,
        endDate: c.end_date as string,
        couponCode: (c.coupon_code as string) || null,
      }));
  }

  // 3) Son siparişler (5 adet)
  let recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }> = [];
  if (dealerId) {
    const { data: orders } = await sb
      .from("bayi_orders")
      .select("id, order_number, status, total_amount, created_at")
      .eq("tenant_id", tenantId)
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false })
      .limit(5);
    recentOrders = (orders ?? []).map((o) => ({
      id: o.id as string,
      orderNumber: (o.order_number as string) || "",
      status: (o.status as string) || "pending",
      totalAmount: Number(o.total_amount ?? 0),
      createdAt: o.created_at as string,
    }));
  }

  // 4) Sık siparişlenen 8 ürün — bayinin geçmiş sipariş kalemlerinden
  let frequentProducts: Array<{
    id: string;
    code: string;
    name: string;
    basePrice: number;
    unit: string;
    imageUrl: string | null;
    stockQuantity: number;
  }> = [];
  if (dealerId) {
    const { data: itemsRaw } = await sb
      .from("bayi_order_items")
      .select("product_id, quantity, bayi_orders!inner(dealer_id, tenant_id)")
      .eq("bayi_orders.dealer_id", dealerId)
      .eq("bayi_orders.tenant_id", tenantId)
      .not("product_id", "is", null)
      .limit(200);

    const counts = new Map<string, number>();
    (itemsRaw ?? []).forEach((it) => {
      const pid = it.product_id as string;
      if (pid) counts.set(pid, (counts.get(pid) ?? 0) + Number(it.quantity ?? 1));
    });
    const top8 = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);

    if (top8.length > 0) {
      const { data: prods } = await sb
        .from("bayi_products")
        .select("id, code, name, base_price, unit, image_url, stock_quantity")
        .eq("tenant_id", tenantId)
        .in("id", top8);
      type ProdRow = {
        id: string;
        code: string | null;
        name: string | null;
        base_price: number | null;
        unit: string | null;
        image_url: string | null;
        stock_quantity: number | null;
      };
      const map = new Map<string, ProdRow>();
      ((prods ?? []) as ProdRow[]).forEach((p) => map.set(p.id, p));
      frequentProducts = top8
        .map((id) => map.get(id))
        .filter((p): p is ProdRow => !!p)
        .map((p) => ({
          id: p.id as string,
          code: (p.code as string) || "",
          name: (p.name as string) || "",
          basePrice: Number(p.base_price ?? 0),
          unit: (p.unit as string) || "adet",
          imageUrl: (p.image_url as string) || null,
          stockQuantity: Number(p.stock_quantity ?? 0),
        }));
    }
  }

  // Fallback: hiç sipariş geçmişi yoksa son eklenen 8 aktif ürün
  if (frequentProducts.length === 0) {
    const { data: latest } = await sb
      .from("bayi_products")
      .select("id, code, name, base_price, unit, image_url, stock_quantity")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8);
    frequentProducts = (latest ?? []).map((p) => ({
      id: p.id as string,
      code: (p.code as string) || "",
      name: (p.name as string) || "",
      basePrice: Number(p.base_price ?? 0),
      unit: (p.unit as string) || "adet",
      imageUrl: (p.image_url as string) || null,
      stockQuantity: Number(p.stock_quantity ?? 0),
    }));
  }

  return NextResponse.json({
    success: true,
    dealer: dealer
      ? {
          id: dealerId,
          segment: dealerSegment,
          region: dealerRegion,
        }
      : null,
    campaigns,
    recentOrders,
    frequentProducts,
    favorites: [] as string[],
  });
}
