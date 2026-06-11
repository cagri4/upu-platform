/**
 * GET  /api/dagitici/depo/transfer — transfer geçmişi.
 * POST /api/dagitici/depo/transfer — depolar arası stok aktarımı.
 *   body: { from_warehouse_id, to_warehouse_id, product_id, quantity, reason? }
 *
 * İki stok hareketi üretir (kaynak −, hedef +) + transfer kaydı. Kaynak
 * stoğu yetersizse 400. applyStockChange ile toplam/eşik senkronlanır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";
import { applyStockChange, maybeEmitStockAlert } from "@/platform/bayi/warehouse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const { data, error } = await sb
    .from("bayi_stock_transfers")
    .select(
      "id, from_warehouse_id, to_warehouse_id, product_id, quantity, reason, status, created_at, " +
        "from:from_warehouse_id(name), to:to_warehouse_id(name), product:product_id(code, name)",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[dagitici:transfer:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  interface TransferRow {
    id: string;
    product_id: string;
    quantity: number;
    reason: string | null;
    status: string;
    created_at: string;
    from: unknown;
    to: unknown;
    product: unknown;
  }
  const rows = (data ?? []) as unknown as TransferRow[];

  return NextResponse.json({
    success: true,
    items: rows.map((t) => ({
      id: t.id,
      fromWarehouse: (pick(t.from)?.name as string) || "—",
      toWarehouse: (pick(t.to)?.name as string) || "—",
      productCode: (pick(t.product)?.code as string) || "",
      productName: (pick(t.product)?.name as string) || "(ürün)",
      quantity: Number(t.quantity) || 0,
      reason: t.reason || null,
      status: t.status,
      createdAt: t.created_at,
    })),
  });
}

interface TransferBody {
  from_warehouse_id?: string;
  to_warehouse_id?: string;
  product_id?: string;
  quantity?: number | string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as TransferBody;
  const fromId = (body.from_warehouse_id || "").trim();
  const toId = (body.to_warehouse_id || "").trim();
  const productId = (body.product_id || "").trim();
  const qty = Math.floor(Number(body.quantity ?? 0));

  if (!fromId || !toId || !productId) {
    return NextResponse.json({ error: "Kaynak, hedef ve ürün zorunlu." }, { status: 400 });
  }
  if (fromId === toId) {
    return NextResponse.json({ error: "Kaynak ve hedef depo aynı olamaz." }, { status: 400 });
  }
  if (!Number.isFinite(qty) || qty < 1) {
    return NextResponse.json({ error: "Geçerli bir miktar gir (≥1)." }, { status: 400 });
  }

  // Depolar + ürün tenant'a ait mi
  const { data: whs } = await sb
    .from("bayi_warehouses")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("id", [fromId, toId]);
  if ((whs ?? []).length !== 2) {
    return NextResponse.json({ error: "Depo bulunamadı." }, { status: 404 });
  }

  // Kaynak stok yeterli mi
  const { data: src } = await sb
    .from("bayi_warehouse_stock")
    .select("quantity")
    .eq("tenant_id", tenantId)
    .eq("warehouse_id", fromId)
    .eq("product_id", productId)
    .maybeSingle();
  const available = src ? Number(src.quantity) || 0 : 0;
  if (available < qty) {
    return NextResponse.json(
      { error: `Kaynak depoda yeterli stok yok (mevcut ${available}).` },
      { status: 400 },
    );
  }

  // Transfer kaydı
  const { data: tr } = await sb
    .from("bayi_stock_transfers")
    .insert({
      tenant_id: tenantId,
      from_warehouse_id: fromId,
      to_warehouse_id: toId,
      product_id: productId,
      quantity: qty,
      reason: body.reason?.trim() || null,
      status: "completed",
      created_by: profileId,
    })
    .select("id")
    .single();

  const refId = (tr?.id as string) || null;
  const reason = `Transfer${body.reason ? `: ${body.reason.trim()}` : ""}`;

  // Bacak 1: kaynaktan çıkış
  await applyStockChange(sb, {
    tenantId,
    warehouseId: fromId,
    productId,
    delta: -qty,
    movementType: "out",
    reason,
    referenceType: "transfer",
    referenceId: refId,
    createdBy: profileId,
  });
  // Bacak 2: hedefe giriş
  const toResult = await applyStockChange(sb, {
    tenantId,
    warehouseId: toId,
    productId,
    delta: qty,
    movementType: "in",
    reason,
    referenceType: "transfer",
    referenceId: refId,
    createdBy: profileId,
  });

  // Toplam değişmedi (transfer iç aktarım) ama kaynak depo min altına
  // düşebilir — kaynak sonucu için ayrı kontrol
  await maybeEmitStockAlert(sb, {
    tenantId,
    warehouseId: fromId,
    productId,
    result: toResult, // product total aynı; alert toplam üzerinden
  });

  return NextResponse.json({ success: true, id: refId });
}
