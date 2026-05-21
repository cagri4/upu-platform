/**
 * GET /api/bayi-stok/list — stok yönetim sayfası için ürün listesi + son hareketler.
 *
 * Tek payload (Promise.all):
 *   - products: bayi_products (id, name, stock_quantity, low_stock_threshold, unit, category)
 *   - recent_movements: son 50 hareket (tüm ürünler)
 *   - pending_supplier_orders: bayi_stock_movements type='supplier_order' (yolda)
 *
 * Kritik seviye client'ta hesaplanır: stock <= low_stock_threshold.
 * Admin + depocu okur.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["admin", "user", "depocu"]);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null; invited_by: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ALLOWED_ROLES.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Depo yetkisi gerekli." }, { status: 403 });
  }

  const tenantId = lookup.tenantId;
  const ownerId = lookup.profile.invited_by || lookup.profile.id;

  const [productsRes, movementsRes, pendingRes] = await Promise.all([
    sb.from("bayi_products")
      .select("id, name, code, unit, stock_quantity, low_stock_threshold, category, brand, is_active")
      .eq("user_id", ownerId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(500),

    sb.from("bayi_stock_movements")
      .select("id, product_id, movement_type, quantity, reason, unit_cost, supplier_name, created_at, created_by")
      .eq("tenant_id", tenantId)
      .neq("movement_type", "supplier_order")
      .order("created_at", { ascending: false })
      .limit(50),

    sb.from("bayi_stock_movements")
      .select("id, product_id, quantity, reason, supplier_name, expected_arrival, unit_cost, created_at")
      .eq("tenant_id", tenantId)
      .eq("movement_type", "supplier_order")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const products = (productsRes.data || []).map(p => {
    const stk = Number(p.stock_quantity) || 0;
    const low = Number(p.low_stock_threshold) || 0;
    let status: "out" | "critical" | "ok" = "ok";
    if (stk <= 0) status = "out";
    else if (low > 0 && stk <= low) status = "critical";
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      unit: p.unit || "adet",
      stockQuantity: stk,
      lowStockThreshold: low,
      category: p.category,
      brand: p.brand,
      status,
    };
  });

  const criticalCount = products.filter(p => p.status === "critical").length;
  const outCount = products.filter(p => p.status === "out").length;

  return NextResponse.json({
    success: true,
    self: { id: lookup.profile.id, role: lookup.profile.role },
    summary: {
      total: products.length,
      critical: criticalCount,
      out: outCount,
      ok: products.length - criticalCount - outCount,
    },
    products,
    recentMovements: (movementsRes.data || []).map(m => ({
      id: m.id,
      productId: m.product_id,
      type: m.movement_type,
      quantity: Number(m.quantity) || 0,
      reason: m.reason,
      unitCost: m.unit_cost !== null ? Number(m.unit_cost) : null,
      createdAt: m.created_at,
      createdBy: m.created_by,
    })),
    pendingSupplierOrders: (pendingRes.data || []).map(o => ({
      id: o.id,
      productId: o.product_id,
      quantity: Number(o.quantity) || 0,
      reason: o.reason,
      supplierName: o.supplier_name,
      expectedArrival: o.expected_arrival,
      unitCost: o.unit_cost !== null ? Number(o.unit_cost) : null,
      createdAt: o.created_at,
    })),
  });
}
