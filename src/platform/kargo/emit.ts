/**
 * emitShipmentForOrder — sipariş kargoya verildiğinde tracking üretme hook'u.
 *
 * Caller: dağıtıcı sipariş detayında "Kargoya Ver" butonu →
 *   `/api/dagitici/siparisler/[id]/kargo` endpoint'i bu fonksiyonu çağırır.
 * Tetik:
 *   1. carrier param (aras/yurtici/mng) veya tenant ayarlarından otomatik
 *      seç (ilk aktif olan)
 *   2. Sipariş + bayi adres al
 *   3. provider.createShipment → trackingNo + trackingUrl
 *   4. bayi_orders güncelle: shipment_carrier + shipment_tracking_no +
 *      shipment_status='created' + shipped_at
 *   5. transitionOrderStatus → 'shipped'
 *
 * Faz 4 hook: emitShipmentEvent → bayiye WA bildirim
 * "Kargonuz çıktı, takip no: ${trackingNo}".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getKargoProviderById, KARGO_PROVIDERS } from "./index";

export interface EmitShipmentResult {
  ok: boolean;
  carrier?: string;
  trackingNo?: string;
  trackingUrl?: string | null;
  mocked?: boolean;
  errorMessage?: string;
  skipped?: "already_shipped" | "no_dealer" | "no_provider";
}

export async function emitShipmentForOrder(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    orderId: string;
    /** Belirli kargo seçilirse, yoksa ilk aktif provider kullanılır. */
    carrier?: string;
  },
): Promise<EmitShipmentResult> {
  const { tenantId, orderId, carrier } = args;

  // 1) Sipariş + idempotency check
  const { data: order } = await sb
    .from("bayi_orders")
    .select(
      "id, order_number, dealer_id, total_amount, payment_method, shipment_tracking_no, shipment_carrier, notes",
    )
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, errorMessage: "Sipariş bulunamadı." };
  if (order.shipment_tracking_no) {
    return {
      ok: true,
      skipped: "already_shipped",
      trackingNo: order.shipment_tracking_no as string,
      carrier: (order.shipment_carrier as string) || undefined,
    };
  }

  // 2) Bayi adresi
  let receiverName = "Bayi";
  let receiverAddress = "—";
  let receiverCity = "Istanbul";
  let receiverDistrict: string | null = null;
  let receiverPhone: string | null = null;

  if (order.dealer_id) {
    const { data: dealer } = await sb
      .from("bayi_dealers")
      .select(
        "name, company_name, address, address_line, city, district, region, phone",
      )
      .eq("tenant_id", tenantId)
      .eq("id", order.dealer_id)
      .maybeSingle();
    if (dealer) {
      receiverName = (dealer.company_name as string) || (dealer.name as string) || receiverName;
      receiverAddress =
        (dealer.address as string) || (dealer.address_line as string) || receiverAddress;
      receiverCity = (dealer.city as string) || (dealer.region as string) || receiverCity;
      receiverDistrict = (dealer.district as string) || null;
      receiverPhone = (dealer.phone as string) || null;
    }
  } else {
    return { ok: false, skipped: "no_dealer" };
  }

  // 3) Provider seç
  let provider = carrier ? getKargoProviderById(carrier) : null;
  if (!provider) {
    // Belirli seçilmediyse: ilk aktif provider'ı bul; yoksa ilk listede (aras)
    const { data: activeSettings } = await sb
      .from("tenant_integration_settings")
      .select("provider")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);
    const activeIds = (activeSettings ?? []).map((s) => s.provider as string);
    for (const p of KARGO_PROVIDERS) {
      if (activeIds.includes(p.id)) {
        provider = p;
        break;
      }
    }
    if (!provider) provider = KARGO_PROVIDERS[0]; // mock fallback
  }
  if (!provider) return { ok: false, skipped: "no_provider" };

  // 4) Adapter çağrısı
  const totalAmount = Number(order.total_amount ?? 0);
  const cod =
    order.payment_method === "open_account" || order.payment_method === "transfer";

  const result = await provider.createShipment(sb, {
    tenantId,
    orderId,
    orderNumber: (order.order_number as string) || orderId,
    receiver: {
      name: receiverName,
      address: receiverAddress,
      city: receiverCity,
      district: receiverDistrict,
      phone: receiverPhone,
    },
    packageDescription: `B2B sipariş #${(order.order_number as string) || ""}`,
    weightKg: null,
    totalAmount,
    cashOnDelivery: cod,
  });

  if (!result.success || !result.trackingNo) {
    return {
      ok: false,
      errorMessage: result.errorMessage || "Kargo oluşturulamadı.",
      carrier: provider.id,
    };
  }

  // 5) DB güncelle
  await sb
    .from("bayi_orders")
    .update({
      shipment_carrier: provider.id,
      shipment_tracking_no: result.trackingNo,
      shipment_status: "created",
      shipped_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", orderId);

  // TODO Faz 4: emitShipmentCreatedEvent → bayiye WA bildirim

  return {
    ok: true,
    carrier: provider.id,
    trackingNo: result.trackingNo,
    trackingUrl: result.trackingUrl ?? null,
    mocked: result.mocked,
  };
}
