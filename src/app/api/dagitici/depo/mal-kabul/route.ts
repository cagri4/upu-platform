/**
 * GET  /api/dagitici/depo/mal-kabul — son mal kabul hareketleri.
 * POST /api/dagitici/depo/mal-kabul — tedarikçiden stok girişi.
 *   body: { warehouse_id, product_id, quantity, batch?, unit_cost?, supplier_name? }
 *
 * applyStockChange ile depo + ürün toplamı güncellenir, movement kaydı atılır
 * (movement_type='in', reference_type='receiving'). Mal kabul stoğu artırır;
 * eşik kontrolü (max üstü uyarı) sonuçta döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";
import { applyStockChange, MAX_STOCK_QTY, MAX_UNIT_COST } from "@/platform/bayi/warehouse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const { data, error } = await sb
    .from("bayi_stock_movements")
    .select("id, product_id, warehouse_id, quantity, reason, supplier_name, unit_cost, created_at, bayi_products(code, name), bayi_warehouses(name)")
    .eq("tenant_id", tenantId)
    .eq("reference_type", "receiving")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[dagitici:mal-kabul:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };
  const rows = (data ?? []) as unknown as Array<{
    id: string; product_id: string; warehouse_id: string; quantity: number;
    reason: string | null; supplier_name: string | null; unit_cost: number | null;
    created_at: string; bayi_products: unknown; bayi_warehouses: unknown;
  }>;

  return NextResponse.json({
    success: true,
    items: rows.map((m) => ({
      id: m.id,
      productCode: (pick(m.bayi_products)?.code as string) || "",
      productName: (pick(m.bayi_products)?.name as string) || "(ürün)",
      warehouse: (pick(m.bayi_warehouses)?.name as string) || "—",
      quantity: Number(m.quantity) || 0,
      supplierName: m.supplier_name || null,
      unitCost: m.unit_cost != null ? Number(m.unit_cost) : null,
      reason: m.reason || null,
      createdAt: m.created_at,
    })),
  });
}

interface ReceiveBody {
  warehouse_id?: string;
  product_id?: string;
  quantity?: number | string;
  batch?: string;
  unit_cost?: number | string;
  supplier_name?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as ReceiveBody;
  const warehouseId = (body.warehouse_id || "").trim();
  const productId = (body.product_id || "").trim();
  const qty = Math.floor(Number(body.quantity ?? 0));

  if (!warehouseId || !productId) {
    return NextResponse.json({ error: "Depo ve ürün zorunlu." }, { status: 400 });
  }
  if (!Number.isFinite(qty) || qty < 1) {
    return NextResponse.json({ error: "Geçerli bir miktar gir (≥1)." }, { status: 400 });
  }
  if (qty > MAX_STOCK_QTY) {
    return NextResponse.json({ error: `Miktar çok yüksek (en fazla ${MAX_STOCK_QTY}).` }, { status: 400 });
  }
  const unitCost =
    body.unit_cost != null && body.unit_cost !== "" ? Number(body.unit_cost) : null;
  if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > MAX_UNIT_COST)) {
    return NextResponse.json({ error: "Geçersiz birim maliyet." }, { status: 400 });
  }

  // Depo + ürün tenant doğrulama
  const [{ data: wh }, { data: prod }] = await Promise.all([
    sb.from("bayi_warehouses").select("id").eq("tenant_id", tenantId).eq("id", warehouseId).maybeSingle(),
    sb.from("bayi_products").select("id").eq("tenant_id", tenantId).eq("id", productId).maybeSingle(),
  ]);
  if (!wh) return NextResponse.json({ error: "Depo bulunamadı." }, { status: 404 });
  if (!prod) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  const batch = body.batch?.trim();
  const reason = `Mal kabul${body.supplier_name ? ` — ${body.supplier_name.trim()}` : ""}${batch ? ` (batch ${batch})` : ""}`;

  const result = await applyStockChange(sb, {
    tenantId,
    warehouseId,
    productId,
    delta: qty,
    movementType: "in",
    reason,
    referenceType: "receiving",
    createdBy: profileId,
    unitCost,
    supplierName: body.supplier_name?.trim() || null,
  });

  return NextResponse.json({
    success: true,
    warehouseQty: result.warehouseQty,
    productTotal: result.productTotal,
    aboveMax: result.aboveMax,
    maxThreshold: result.maxThreshold,
  });
}
