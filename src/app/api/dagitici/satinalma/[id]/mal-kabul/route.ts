/**
 * POST /api/dagitici/satinalma/[id]/mal-kabul — PO'dan mal kabul (Faz 5 depo wiring).
 *   body: { warehouse_id, lines: [{ line_id, received_qty }] }
 *
 * Seçilen PO satırlarının "gerçek gelen" adetleri girilir. Her satır için
 * Faz 5 atomik RPC (applyStockChange, movement_type='in',
 * reference_type='purchase') ile depo stoğu artar; po_lines.received_qty
 * güncellenir. Tüm satırlar tam geldiyse PO 'received', kısmi geldiyse
 * 'partial'. Sadece 'sent'/'partial' PO'dan mal kabul edilebilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";
import { applyStockChange, MAX_STOCK_QTY } from "@/platform/bayi/warehouse";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RecvLine {
  line_id?: string;
  received_qty?: number | string;
}
interface RecvBody {
  warehouse_id?: string;
  lines?: RecvLine[];
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as RecvBody;
  const warehouseId = (body.warehouse_id || "").trim();
  const recvLines = Array.isArray(body.lines) ? body.lines : [];
  if (!warehouseId) return NextResponse.json({ error: "Depo zorunlu." }, { status: 400 });
  if (recvLines.length === 0) return NextResponse.json({ error: "Mal kabul satırı yok." }, { status: 400 });

  // PO + durum kontrolü
  const { data: po } = await sb
    .from("bayi_purchase_orders")
    .select("id, status, po_number")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!po) return NextResponse.json({ error: "PO bulunamadı." }, { status: 404 });
  if (!["sent", "partial"].includes(po.status as string)) {
    return NextResponse.json(
      { error: "Sadece gönderilmiş veya kısmi PO'dan mal kabul yapılabilir." },
      { status: 400 },
    );
  }

  // Depo tenant doğrula
  const { data: wh } = await sb
    .from("bayi_warehouses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", warehouseId)
    .maybeSingle();
  if (!wh) return NextResponse.json({ error: "Depo bulunamadı." }, { status: 404 });

  // PO satırları
  const { data: poLines } = await sb
    .from("bayi_purchase_order_lines")
    .select("id, product_id, quantity, received_qty, unit_price")
    .eq("tenant_id", tenantId)
    .eq("po_id", id);
  const lineMap = new Map<string, { id: string; product_id: string; quantity: number; received_qty: number; unit_price: number }>();
  for (const l of poLines ?? []) {
    lineMap.set(l.id as string, {
      id: l.id as string,
      product_id: l.product_id as string,
      quantity: Number(l.quantity) || 0,
      received_qty: Number(l.received_qty) || 0,
      unit_price: Number(l.unit_price) || 0,
    });
  }

  let appliedCount = 0;
  for (const r of recvLines) {
    const lineId = (r.line_id || "").trim();
    const line = lineMap.get(lineId);
    if (!line) continue; // PO'ya ait olmayan satır → atla
    const recv = Math.floor(Number(r.received_qty ?? 0));
    if (!Number.isFinite(recv) || recv <= 0) continue;
    if (recv > MAX_STOCK_QTY) {
      return NextResponse.json({ error: `Miktar çok yüksek (en fazla ${MAX_STOCK_QTY}).` }, { status: 400 });
    }
    const remaining = Math.max(0, line.quantity - line.received_qty);
    const toReceive = Math.min(recv, remaining);
    if (toReceive <= 0) continue;

    // Faz 5 atomik stok artışı
    await applyStockChange(sb, {
      tenantId,
      warehouseId,
      productId: line.product_id,
      delta: toReceive,
      movementType: "in",
      reason: `Mal kabul — PO #${po.po_number}`,
      referenceType: "purchase",
      referenceId: id,
      unitCost: line.unit_price || null,
      createdBy: profileId,
    });

    // Satır gelen adedi güncelle
    await sb
      .from("bayi_purchase_order_lines")
      .update({ received_qty: line.received_qty + toReceive, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", line.id);
    line.received_qty += toReceive;
    appliedCount += 1;
  }

  if (appliedCount === 0) {
    return NextResponse.json({ error: "Uygulanabilir mal kabul satırı yok." }, { status: 400 });
  }

  // PO durumunu yeniden hesapla
  const allLines = Array.from(lineMap.values());
  const fullyReceived = allLines.every((l) => l.received_qty >= l.quantity);
  const anyReceived = allLines.some((l) => l.received_qty > 0);
  const newStatus = fullyReceived ? "received" : anyReceived ? "partial" : po.status;
  if (newStatus !== po.status) {
    await sb
      .from("bayi_purchase_orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", id);
  }

  return NextResponse.json({
    success: true,
    status: newStatus,
    appliedLines: appliedCount,
    lines: allLines.map((l) => ({ id: l.id, quantity: l.quantity, receivedQty: l.received_qty, remaining: Math.max(0, l.quantity - l.received_qty) })),
  });
}
