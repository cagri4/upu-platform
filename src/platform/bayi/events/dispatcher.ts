/**
 * B2B Portal olay motoru — Faz 4.
 *
 * Faz 3'te yer işaretlenmiş hook'ların gerçek implementasyonu:
 *   emitOrderEvent          — sipariş created/approved/rejected/shipped
 *   emitInvoiceCreatedEvent — fatura kesildi → bayiye
 *   emitShipmentCreatedEvent— kargo çıktı → bayiye (emitOrderEvent shipped sarmalar)
 *   emitPaymentReceivedEvent— ödeme alındı → bayiye teşekkür + dağıtıcıya bilgi
 *   emitCampaignActivatedEvent — kampanya aktive → hedef bayilere
 *
 * Gönderim katmanı: sendNotification (#91 altyapısı) — in-app feed (DB) +
 * WA (mock veya canlı). Mod tenant ayarından:
 *   tenant_integration_settings provider='wa_bildirim'
 *     - kayıt yok        → bildirimler AÇIK, mode=mock (default)
 *     - is_active=false  → WA tamamen kapalı (in-app feed yine yazılır,
 *                          mockWa=true ile log'lanır ama "wa-off" işareti)
 *     - config.mode      → 'mock' (default) | 'live'
 *
 * MOCK SEND: Meta template onayları (24-48h) gelene kadar gerçek WA
 * gönderimi yok; notifications tablosuna 'wa-mock' channel ile düşer,
 * bayi/dağıtıcı in-app bildirim merkezinde görür.
 *
 * Alıcı çözümleme:
 *   dealer      → bayi_dealers.user_id → profiles (or id/auth_user_id)
 *   distributor → profiles where tenant_id + role in (admin,user) ilk kayıt
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "@/platform/notifications/send-notification";
import { getIntegrationSetting } from "@/platform/integrations/tenant-settings";
import type { BayiEventType } from "./types";

const PORTAL_HOST = "https://retailai.upudev.nl";

interface WaMode {
  enabled: boolean;
  mock: boolean;
}

async function getWaMode(sb: SupabaseClient, tenantId: string): Promise<WaMode> {
  const setting = await getIntegrationSetting(sb, tenantId, "wa_bildirim");
  if (!setting) return { enabled: true, mock: true }; // default: açık + mock
  if (!setting.isActive) return { enabled: false, mock: true };
  const mode = (setting.config.mode as string) || "mock";
  return { enabled: true, mock: mode !== "live" };
}

/** dealer.user_id (auth id olabilir) → profiles.id çözer. */
async function resolveDealerProfileId(
  sb: SupabaseClient,
  tenantId: string,
  dealerId: string,
): Promise<string | null> {
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("id", dealerId)
    .maybeSingle();
  const uid = (dealer?.user_id as string) || null;
  if (!uid) return null;
  const { data: profile } = await sb
    .from("profiles")
    .select("id")
    .or(`id.eq.${uid},auth_user_id.eq.${uid}`)
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  return (profile?.id as string) || null;
}

/** Tenant sahibi (dağıtıcı) profilini çözer. */
async function resolveDistributorProfileId(
  sb: SupabaseClient,
  tenantId: string,
): Promise<string | null> {
  const { data: profile } = await sb
    .from("profiles")
    .select("id, role")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "user"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (profile?.id as string) || null;
}

interface DispatchArgs {
  tenantId: string;
  type: BayiEventType;
  /** dealer audience event'lerinde zorunlu. */
  dealerId?: string | null;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  /** Panel click hedefi (relative veya absolute). */
  clickTarget?: string;
}

export interface DispatchResult {
  ok: boolean;
  notificationId?: number | null;
  channels?: string[];
  skipped?: "wa-off-but-logged" | "no-recipient" | "pref" | "tier" | "error";
}

/**
 * Tek bir olayı tek alıcıya iletir. Hata fırlatmaz — event dispatch asla
 * iş akışını (sipariş onayı vb.) bloklamamalı.
 */
export async function dispatchBayiEvent(
  sb: SupabaseClient,
  args: DispatchArgs,
): Promise<DispatchResult> {
  try {
    const isDealer = args.type.startsWith("bayi_");
    let profileId: string | null = null;
    if (isDealer) {
      if (!args.dealerId) return { ok: false, skipped: "no-recipient" };
      profileId = await resolveDealerProfileId(sb, args.tenantId, args.dealerId);
    } else {
      profileId = await resolveDistributorProfileId(sb, args.tenantId);
    }
    if (!profileId) return { ok: false, skipped: "no-recipient" };

    const mode = await getWaMode(sb, args.tenantId);
    const panelUrl = args.clickTarget
      ? /^https?:\/\//.test(args.clickTarget)
        ? args.clickTarget
        : `${PORTAL_HOST}${args.clickTarget.startsWith("/") ? "" : "/"}${args.clickTarget}`
      : PORTAL_HOST;

    const result = await sendNotification({
      userId: profileId,
      type: args.type,
      title: args.title,
      body: args.body,
      payload: {
        ...(args.payload || {}),
        click_target: args.clickTarget || "/tr/bayi",
      },
      tenantName: "Bayi",
      panelUrl,
      // WA kapalıysa da mock path'e yönlendir (in-app feed korunur,
      // gerçek WA hiçbir durumda gitmez)
      mockWa: mode.mock || !mode.enabled,
    });

    return {
      ok: result.notification_id != null,
      notificationId: result.notification_id,
      channels: result.channels,
      skipped: result.skipped,
    };
  } catch (err) {
    console.error("[bayi:event:dispatch]", args.type, err);
    return { ok: false, skipped: "error" };
  }
}

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

// ──────────────────────────────────────────────────────────────────────
// Faz 5 — Depo: kritik stok eventi (dağıtıcıya)
// ──────────────────────────────────────────────────────────────────────

/**
 * Ürün toplam stoğu min eşiğin altına düştü → dağıtıcıya "kritik stok"
 * bildirimi (in-app + WA-mock). Mevcut dagitici_kritik_stok event tipi.
 */
export async function emitWarehouseCriticalStockEvent(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    warehouseId: string;
    productId: string;
    productName: string;
    currentQuantity: number;
    threshold: number;
  },
): Promise<void> {
  await dispatchBayiEvent(sb, {
    tenantId: args.tenantId,
    type: "dagitici_kritik_stok",
    title: `Kritik stok: ${args.productName}`,
    body: `${args.productName} stoğu kritik eşiğin altına düştü — kalan ${args.currentQuantity}, eşik ${args.threshold}. Sipariş/sevkiyat planını gözden geçir.`,
    payload: {
      warehouse_id: args.warehouseId,
      product_id: args.productId,
      product_name: args.productName,
      current_quantity: args.currentQuantity,
      threshold: args.threshold,
    },
    clickTarget: "/tr/dagitici-panel/depo",
  });
}

// ──────────────────────────────────────────────────────────────────────
// Faz 3 hook'larının çağıracağı yüzeyler
// ──────────────────────────────────────────────────────────────────────

export type OrderEventKind = "created" | "approved" | "rejected" | "shipped";

export async function emitOrderEvent(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    orderId: string;
    kind: OrderEventKind;
    /** rejected için sebep; shipped için tracking bilgisi. */
    extra?: {
      reason?: string;
      carrier?: string;
      carrierLabel?: string;
      trackingNo?: string;
      trackingUrl?: string | null;
    };
  },
): Promise<void> {
  const { tenantId, orderId, kind, extra } = args;

  const { data: order } = await sb
    .from("bayi_orders")
    .select("order_number, dealer_id, total_amount")
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const orderNumber = (order.order_number as string) || orderId.slice(0, 8);
  const dealerId = (order.dealer_id as string) || null;
  const amount = formatPara(Number(order.total_amount ?? 0));

  let dealerName = "Bayi";
  if (dealerId) {
    const { data: d } = await sb
      .from("bayi_dealers")
      .select("name, company_name")
      .eq("tenant_id", tenantId)
      .eq("id", dealerId)
      .maybeSingle();
    dealerName = (d?.company_name as string) || (d?.name as string) || dealerName;
  }

  if (kind === "created") {
    // Bayiye: sipariş alındı
    await dispatchBayiEvent(sb, {
      tenantId,
      type: "bayi_siparis_alindi",
      dealerId,
      title: `Siparişin alındı — #${orderNumber}`,
      body: `${amount} tutarındaki siparişin dağıtıcı onayına gönderildi. Onaylanınca tekrar haber vereceğiz.`,
      payload: { order_id: orderId, order_number: orderNumber, amount },
      clickTarget: `/tr/bayi/siparislerim/${orderId}`,
    });
    // Dağıtıcıya: yeni sipariş geldi
    await dispatchBayiEvent(sb, {
      tenantId,
      type: "dagitici_yeni_siparis",
      title: `Yeni sipariş — ${dealerName}`,
      body: `${dealerName} bayisinden #${orderNumber} numaralı ${amount} tutarında yeni sipariş geldi. Onay bekliyor.`,
      payload: { order_id: orderId, order_number: orderNumber, amount, dealer_name: dealerName },
      clickTarget: `/tr/dagitici-panel/siparisler/${orderId}`,
    });
    return;
  }

  if (kind === "approved") {
    await dispatchBayiEvent(sb, {
      tenantId,
      type: "bayi_siparis_onaylandi",
      dealerId,
      title: `Siparişin onaylandı — #${orderNumber}`,
      body: `#${orderNumber} numaralı siparişin onaylandı ve hazırlığa alındı. Kargoya verildiğinde takip numaranı ileteceğiz.`,
      payload: {
        order_id: orderId,
        order_number: orderNumber,
        amount,
        delivery_note: "Tahmini teslim: 2-3 iş günü",
      },
      clickTarget: `/tr/bayi/siparislerim/${orderId}`,
    });
    return;
  }

  if (kind === "rejected") {
    await dispatchBayiEvent(sb, {
      tenantId,
      type: "bayi_siparis_reddedildi",
      dealerId,
      title: `Siparişin onaylanamadı — #${orderNumber}`,
      body: `#${orderNumber} numaralı siparişin reddedildi. Sebep: ${extra?.reason || "Belirtilmedi"}. Detay için siparişlerine bak.`,
      payload: { order_id: orderId, order_number: orderNumber, reason: extra?.reason || "Belirtilmedi" },
      clickTarget: `/tr/bayi/siparislerim/${orderId}`,
    });
    return;
  }

  if (kind === "shipped") {
    const carrierLabel = extra?.carrierLabel || extra?.carrier || "Kargo";
    await dispatchBayiEvent(sb, {
      tenantId,
      type: "bayi_kargo_cikti",
      dealerId,
      title: `Kargon yola çıktı — #${orderNumber}`,
      body: `#${orderNumber} numaralı siparişin ${carrierLabel} ile yola çıktı. Takip no: ${extra?.trackingNo || "—"}`,
      payload: {
        order_id: orderId,
        order_number: orderNumber,
        carrier: extra?.carrier,
        carrier_label: carrierLabel,
        tracking_no: extra?.trackingNo,
        tracking_url: extra?.trackingUrl || null,
      },
      clickTarget: `/tr/bayi/siparislerim/${orderId}`,
    });
  }
}

export async function emitInvoiceCreatedEvent(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    orderId: string;
    invoiceId: string;
    invoiceNo: string;
    dealerId: string | null;
    amount: number;
    dueDate: string;
  },
): Promise<void> {
  await dispatchBayiEvent(sb, {
    tenantId: args.tenantId,
    type: "bayi_fatura_kesildi",
    dealerId: args.dealerId,
    title: `Faturan hazır — ${args.invoiceNo}`,
    body: `${formatPara(args.amount)} tutarındaki faturan kesildi (vade: ${args.dueDate}). PDF'i faturalarım sayfasından indirebilirsin.`,
    payload: {
      invoice_id: args.invoiceId,
      invoice_no: args.invoiceNo,
      order_id: args.orderId,
      amount: formatPara(args.amount),
      due_date: args.dueDate,
    },
    clickTarget: `/tr/bayi/faturalarim`,
  });
}

export async function emitShipmentCreatedEvent(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    orderId: string;
    carrier: string;
    carrierLabel: string;
    trackingNo: string;
    trackingUrl: string | null;
  },
): Promise<void> {
  await emitOrderEvent(sb, {
    tenantId: args.tenantId,
    orderId: args.orderId,
    kind: "shipped",
    extra: {
      carrier: args.carrier,
      carrierLabel: args.carrierLabel,
      trackingNo: args.trackingNo,
      trackingUrl: args.trackingUrl,
    },
  });
}

export async function emitPaymentReceivedEvent(
  sb: SupabaseClient,
  args: {
    tenantId: string;
    orderId: string | null;
    dealerId: string | null;
    amount: number;
  },
): Promise<void> {
  await dispatchBayiEvent(sb, {
    tenantId: args.tenantId,
    type: "bayi_odeme_alindi",
    dealerId: args.dealerId,
    title: "Ödemen alındı 🙏",
    body: `${formatPara(args.amount)} tutarındaki ödemen başarıyla işlendi. Teşekkürler!`,
    payload: {
      order_id: args.orderId,
      amount: formatPara(args.amount),
    },
    clickTarget: args.orderId ? `/tr/bayi/siparislerim/${args.orderId}` : "/tr/bayi/faturalarim",
  });
}

/** Kampanya aktive → hedeflemesine uyan tüm bayilere bildirim. */
export async function emitCampaignActivatedEvent(
  sb: SupabaseClient,
  args: { tenantId: string; campaignId: string },
): Promise<{ notified: number }> {
  const { tenantId, campaignId } = args;

  const { data: camp } = await sb
    .from("bayi_campaigns")
    .select("title, description, type")
    .eq("tenant_id", tenantId)
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) return { notified: 0 };

  // Hedefleme → uyan dealer id seti
  const { data: targets } = await sb
    .from("bayi_campaign_targets")
    .select("target_type, target_value")
    .eq("tenant_id", tenantId)
    .eq("campaign_id", campaignId);
  if (!targets || targets.length === 0) return { notified: 0 };

  let query = sb
    .from("bayi_dealers")
    .select("id, segment, region")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .not("user_id", "is", null);
  const { data: dealers } = await query;

  const matched = (dealers ?? []).filter((d) =>
    targets.some((t) => {
      if (t.target_type === "all") return true;
      if (t.target_type === "segment" && t.target_value === d.segment) return true;
      if (t.target_type === "region" && t.target_value === d.region) return true;
      if (t.target_type === "dealer" && t.target_value === d.id) return true;
      return false;
    }),
  );

  let notified = 0;
  for (const d of matched.slice(0, 200)) {
    const r = await dispatchBayiEvent(sb, {
      tenantId,
      type: "bayi_yeni_kampanya",
      dealerId: d.id as string,
      title: `Yeni kampanya: ${camp.title}`,
      body: (camp.description as string) || `${camp.title} kampanyası başladı — kataloğa göz at.`,
      payload: { campaign_id: campaignId, campaign_title: camp.title },
      clickTarget: "/tr/bayi/katalog",
    });
    if (r.ok) notified++;
  }
  return { notified };
}
