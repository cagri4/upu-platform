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

  // PO satırları — yalnız bu PO'ya ait line id'lerini doğrulamak için (tenant scoped)
  const { data: poLines } = await sb
    .from("bayi_purchase_order_lines")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("po_id", id);
  const validLineIds = new Set((poLines ?? []).map((l) => l.id as string));

  let appliedCount = 0;
  for (const r of recvLines) {
    const lineId = (r.line_id || "").trim();
    if (!validLineIds.has(lineId)) continue; // PO'ya ait olmayan satır → atla
    const recv = Math.floor(Number(r.received_qty ?? 0));
    if (!Number.isFinite(recv) || recv <= 0) continue;
    if (recv > MAX_STOCK_QTY) {
      return NextResponse.json({ error: `Miktar çok yüksek (en fazla ${MAX_STOCK_QTY}).` }, { status: 400 });
    }

    // H-19: received_qty'yi atomik + üst-sınırlı artır (FOR UPDATE), GERÇEK
    // uygulanan delta'yı al. Eşzamanlı çağrılarda over-receive + stok şişmesi
    // engellenir; tekrar gelen istek applied=0 → stok değişmez (idempotent).
    const { data: rpc, error: rpcErr } = await sb.rpc("bayi_receive_po_line", {
      p_tenant: tenantId,
      p_line: lineId,
      p_recv: recv,
    });
    if (rpcErr) {
      console.error("[dagitici:satinalma:mal-kabul:rpc]", rpcErr);
      return NextResponse.json({ error: "Mal kabul kaydedilemedi." }, { status: 500 });
    }
    const row = (Array.isArray(rpc) ? rpc[0] : rpc) as
      | { applied: number | string; product_id: string; unit_price: number | string | null }
      | undefined;
    const applied = Number(row?.applied ?? 0);
    if (!row || applied <= 0) continue; // zaten tam alınmış / kilitli satır yok

    // Faz 5 atomik stok artışı — yalnız gerçekten kabul edilen delta kadar
    await applyStockChange(sb, {
      tenantId,
      warehouseId,
      productId: row.product_id,
      delta: applied,
      movementType: "in",
      reason: `Mal kabul — PO #${po.po_number}`,
      referenceType: "purchase",
      referenceId: id,
      unitCost: row.unit_price != null ? Number(row.unit_price) : null,
      createdBy: profileId,
    });
    appliedCount += 1;
  }

  if (appliedCount === 0) {
    return NextResponse.json({ error: "Uygulanabilir mal kabul satırı yok." }, { status: 400 });
  }

  // H-20: PO durumunu DB'den TAZE oku (snapshot değil) → eşzamanlılıkta tutarlı
  const { data: freshLines } = await sb
    .from("bayi_purchase_order_lines")
    .select("quantity, received_qty")
    .eq("tenant_id", tenantId)
    .eq("po_id", id);
  const fl = freshLines ?? [];
  const fullyReceived = fl.length > 0 && fl.every((l) => Number(l.received_qty) >= Number(l.quantity));
  const anyReceived = fl.some((l) => Number(l.received_qty) > 0);
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
    lines: fl.map((l) => ({ quantity: Number(l.quantity), receivedQty: Number(l.received_qty), remaining: Math.max(0, Number(l.quantity) - Number(l.received_qty)) })),
  });
}
