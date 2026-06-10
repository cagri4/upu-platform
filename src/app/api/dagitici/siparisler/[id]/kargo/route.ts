/**
 * POST /api/dagitici/siparisler/[id]/kargo — siparişi kargoya ver.
 *
 * body: { carrier?: 'aras'|'yurtici'|'mng' }  carrier verilmezse aktif
 * provider'ın ilki, yoksa Aras mock.
 *
 * Sipariş status='approved' → 'shipped' geçişi:
 *   1. emitShipmentForOrder hook (tracking üretir + DB'ye yazar)
 *   2. transitionOrderStatus('shipped') (audit log)
 *
 * Faz 4 hook: shipmentCreated → bayiye WA "Kargonuz çıktı".
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";
import { emitShipmentForOrder } from "@/platform/kargo/emit";
import { transitionOrderStatus } from "@/platform/bayi/order-status";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ShipBody {
  carrier?: string;
}

const ALLOWED_CARRIERS = ["aras", "yurtici", "mng"];

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as ShipBody;
  const carrier =
    body.carrier && ALLOWED_CARRIERS.includes(body.carrier)
      ? body.carrier
      : undefined;

  // Mevcut sipariş durumu kontrol
  const { data: order } = await sb
    .from("bayi_orders")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }
  const currentStatus = (order.status as string) || "pending";
  if (currentStatus !== "approved" && currentStatus !== "preparing") {
    return NextResponse.json(
      {
        error: `Kargoya vermek için sipariş onaylanmış olmalı (şu an: ${currentStatus}).`,
      },
      { status: 400 },
    );
  }

  // Kargo oluştur
  const result = await emitShipmentForOrder(sb, {
    tenantId,
    orderId: id,
    carrier,
  });

  if (!result.ok && !result.skipped) {
    return NextResponse.json(
      { error: result.errorMessage || "Kargo oluşturulamadı." },
      { status: 502 },
    );
  }

  // Status: approved/preparing → shipped (allow either)
  // transitionOrderStatus pending→approved/rejected guard'ı var; shipped
  // için ayrı transition: doğrudan update + audit.
  await sb
    .from("bayi_orders")
    .update({ status: "shipped", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  await sb.from("bayi_order_status_history").insert({
    tenant_id: tenantId,
    order_id: id,
    from_status: currentStatus,
    to_status: "shipped",
    reason: `${result.carrier} ${result.mocked ? "(mock)" : ""} takip no ${result.trackingNo}`,
    changed_by_profile_id: profileId,
  });

  // Faz 4: bayiye "kargon yola çıktı" bildirimi (takip linki ile)
  try {
    const { emitShipmentCreatedEvent } = await import("@/platform/bayi/events/dispatcher");
    const CARRIER_LABELS: Record<string, string> = {
      aras: "Aras Kargo",
      yurtici: "Yurtiçi Kargo",
      mng: "MNG Kargo",
    };
    await emitShipmentCreatedEvent(sb, {
      tenantId,
      orderId: id,
      carrier: result.carrier || "aras",
      carrierLabel: CARRIER_LABELS[result.carrier || ""] || result.carrier || "Kargo",
      trackingNo: result.trackingNo || "—",
      trackingUrl: result.trackingUrl ?? null,
    });
  } catch (err) {
    console.error("[kargo:event]", err);
  }

  return NextResponse.json({
    success: true,
    carrier: result.carrier,
    trackingNo: result.trackingNo,
    trackingUrl: result.trackingUrl,
    mocked: !!result.mocked,
  });
}
