/**
 * POST /api/bayi-dealer-orders/[id]/update-shipment
 * Body: { shipment_status, tracking_number?, driver_name?, vehicle_plate?, delivered_photo_url? }
 *
 * B2B iç sevkiyat akışı (#6.3 revize, DHL/PostNL API yok).
 * Status enum (lifecycle: pending..delivered) ile EŞZAMANLI ayrı kolon:
 *   shipment_status IN ('hazirlandi','yola_cikti','teslim_edildi','iade')
 *
 * Yetki: admin/satis/depocu role veya DEALER_SHIPMENT_UPDATE capability.
 * pending/cancelled/rejected sipariş'te sevkiyat reddedilir.
 *
 * Yan etki:
 *   - yola_cikti / teslim_edildi → bayiye WA bildirim (best-effort).
 *   - teslim_edildi → status='delivered' + delivered_at damgala.
 *   - history kayıt (shipment_status değişimi + status değişimi ayrı satır).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { sendText } from "@/platform/whatsapp/send";
import { hasCapability, BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export type ShipmentStatus = "hazirlandi" | "yola_cikti" | "teslim_edildi" | "iade";
const VALID_SHIPMENT: ShipmentStatus[] = ["hazirlandi", "yola_cikti", "teslim_edildi", "iade"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }
  const { id } = await params;

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null; capabilities: string[] | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role, capabilities",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const role = lookup.profile.role || "";
  const caps = lookup.profile.capabilities || [];
  const allowed = ["admin", "satis", "depocu"].includes(role)
    || hasCapability(caps, BAYI_CAPABILITIES.DEALER_SHIPMENT_UPDATE);
  if (!allowed) {
    return NextResponse.json({ error: "Sevkiyat güncelleme yetkiniz yok." }, { status: 403 });
  }

  let body: {
    shipment_status?: ShipmentStatus;
    tracking_number?: string | null;
    driver_name?: string | null;
    vehicle_plate?: string | null;
    delivered_photo_url?: string | null;
  } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }
  if (!body.shipment_status || !VALID_SHIPMENT.includes(body.shipment_status)) {
    return NextResponse.json({ error: "Geçerli shipment_status gerekli." }, { status: 400 });
  }

  const { data: order } = await sb
    .from("bayi_dealer_orders")
    .select("id, status, shipment_status, dealer_user_id")
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });

  if (["pending", "cancelled", "rejected"].includes(order.status)) {
    return NextResponse.json({
      error: `Sevkiyat sadece onaylı sipariş için güncellenebilir (mevcut: ${order.status}).`,
    }, { status: 409 });
  }

  const patch: Record<string, unknown> = { shipment_status: body.shipment_status };
  if (body.tracking_number !== undefined)     patch.tracking_number = body.tracking_number || null;
  if (body.driver_name !== undefined)         patch.driver_name = body.driver_name || null;
  if (body.vehicle_plate !== undefined)       patch.vehicle_plate = body.vehicle_plate || null;
  if (body.delivered_photo_url !== undefined) patch.delivered_photo_url = body.delivered_photo_url || null;

  let statusChanged = false;
  if (body.shipment_status === "teslim_edildi" && order.status !== "delivered") {
    patch.status = "delivered";
    patch.delivered_at = new Date().toISOString();
    statusChanged = true;
  }

  const { error: updErr } = await sb
    .from("bayi_dealer_orders")
    .update(patch)
    .eq("id", id);
  if (updErr) {
    console.error("[update-shipment] err:", updErr);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }

  if (order.shipment_status !== body.shipment_status) {
    await sb.from("bayi_dealer_order_status_history").insert({
      order_id: id,
      old_status: order.shipment_status ? `shipment:${order.shipment_status}` : "shipment:-",
      new_status: `shipment:${body.shipment_status}`,
      changed_by_user_id: lookup.profile.id,
      reason: null,
    });
  }
  if (statusChanged) {
    await sb.from("bayi_dealer_order_status_history").insert({
      order_id: id,
      old_status: order.status,
      new_status: "delivered",
      changed_by_user_id: lookup.profile.id,
      reason: "Sevkiyat teslim edildi",
    });
  }

  let notified = false;
  if (body.shipment_status === "yola_cikti" || body.shipment_status === "teslim_edildi") {
    notified = await notifyDealerShipment(sb, order.dealer_user_id, id, body.shipment_status, {
      tracking_number: body.tracking_number ?? null,
      vehicle_plate: body.vehicle_plate ?? null,
      driver_name: body.driver_name ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    shipment_status: body.shipment_status,
    status: statusChanged ? "delivered" : order.status,
    wa_notified: notified,
  });
}

async function notifyDealerShipment(
  sb: SupabaseClient,
  dealerUserId: string,
  orderId: string,
  shipment: ShipmentStatus,
  extra: { tracking_number: string | null; vehicle_plate: string | null; driver_name: string | null },
): Promise<boolean> {
  try {
    const { data: dealer } = await sb
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", dealerUserId)
      .maybeSingle();
    if (!dealer?.whatsapp_phone) return false;

    const shortId = `#${orderId.slice(0, 8)}`;
    const lines: string[] = [];
    if (shipment === "yola_cikti") {
      lines.push(`🚚 Siparişiniz ${shortId} yola çıktı.`);
      if (extra.tracking_number) lines.push(`Takip no: ${extra.tracking_number}`);
      if (extra.vehicle_plate)   lines.push(`Plaka: ${extra.vehicle_plate}`);
      if (extra.driver_name)     lines.push(`Sürücü: ${extra.driver_name}`);
    } else {
      lines.push(`📍 Siparişiniz ${shortId} teslim edildi. Teşekkürler!`);
    }
    await sendText(dealer.whatsapp_phone, lines.join("\n"));
    return true;
  } catch (err) {
    console.error("[notifyDealerShipment]", err);
    return false;
  }
}
