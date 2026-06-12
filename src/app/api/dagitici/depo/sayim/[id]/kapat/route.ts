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

  // H-17: atomik durum geçişi — kapatmayı TEK statement'ta "kazan"
  // (WHERE status='open' RETURNING). İki paralel kapatmadan yalnız biri
  // satır döndürür; diğeri 0 satır → 409. Check-then-act TOCTOU penceresi
  // kapanır (düzeltmeler ancak kapatmayı kazandıktan sonra uygulanır).
  const { data: claimed } = await sb
    .from("bayi_stocktake_sessions")
    .update({ status: "closed", closed_by: profileId, closed_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .eq("status", "open")
    .select("id, warehouse_id, title");

  const s = (claimed ?? [])[0] as { id: string; warehouse_id: string; title: string } | undefined;
  if (!s) {
    // Ya yok ya da zaten kapalı/başka istek kazandı
    const { data: exists } = await sb
      .from("bayi_stocktake_sessions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    return NextResponse.json(
      { error: exists ? "Sayım zaten kapalı." : "Sayım bulunamadı." },
      { status: exists ? 409 : 404 },
    );
  }
  const warehouseId = s.warehouse_id;

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

  // Durum zaten başta atomik olarak 'closed' yapıldı (H-17).
  return NextResponse.json({ success: true, corrections });
}
