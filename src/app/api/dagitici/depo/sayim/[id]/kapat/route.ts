/**
 * POST /api/dagitici/depo/sayim/[id]/kapat — sayımı kapat + fark düzeltme.
 *
 * Sayılan ≠ beklenen olan her satır için applyStockChange('adjust', delta=
 * sayılan−mevcut) ile depo stoğu fiziki sayıma çekilir + movement/audit kaydı
 * (reference_type='stocktake'). Oturum status='closed'. Düzeltme min eşiği
 * altına çekerse kritik stok eventi tetiklenir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../../_auth";
import { applyStockChange, maybeEmitStockAlert } from "@/platform/bayi/warehouse";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;
  const { id } = await params;

  const { data: s } = await sb
    .from("bayi_stocktake_sessions")
    .select("id, status, warehouse_id, title")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!s) return NextResponse.json({ error: "Sayım bulunamadı." }, { status: 404 });
  if (s.status !== "open") {
    return NextResponse.json({ error: "Sayım zaten kapalı." }, { status: 409 });
  }
  const warehouseId = s.warehouse_id as string;

  const { data: items } = await sb
    .from("bayi_stocktake_items")
    .select("product_id, expected_qty, counted_qty")
    .eq("tenant_id", tenantId)
    .eq("session_id", id);

  let corrections = 0;
  for (const it of items ?? []) {
    if (it.counted_qty == null) continue;
    const counted = Number(it.counted_qty) || 0;
    const productId = it.product_id as string;

    // Mevcut depo stoğu (drift'e karşı taze oku) → delta = sayılan − mevcut
    const { data: cur } = await sb
      .from("bayi_warehouse_stock")
      .select("quantity")
      .eq("tenant_id", tenantId)
      .eq("warehouse_id", warehouseId)
      .eq("product_id", productId)
      .maybeSingle();
    const current = cur ? Number(cur.quantity) || 0 : 0;
    const delta = counted - current;
    if (delta === 0) continue;

    const result = await applyStockChange(sb, {
      tenantId,
      warehouseId,
      productId,
      delta,
      movementType: "adjust",
      reason: `Sayım düzeltme: ${s.title} (sayılan ${counted}, sistem ${current})`,
      referenceType: "stocktake",
      referenceId: id,
      createdBy: profileId,
    });
    corrections += 1;
    await maybeEmitStockAlert(sb, { tenantId, warehouseId, productId, result });
  }

  await sb
    .from("bayi_stocktake_sessions")
    .update({ status: "closed", closed_by: profileId, closed_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  return NextResponse.json({ success: true, corrections });
}
