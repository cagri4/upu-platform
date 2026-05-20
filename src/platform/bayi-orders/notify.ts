/**
 * Bayi sipariş durum bildirim helper'ı.
 *
 * Status değişimlerinde:
 *   1. bayi_dealer_order_status_history kayıt yaz
 *   2. order.status update + tarih kolonu (confirmed_at, shipped_at, vs.)
 *   3. Bayi'ye WA bot mesajı dene (24h window dışı sessiz drop OK).
 *
 * Mevcut send.ts sendText kullanır — Meta API başarısızlığı yutulur (yeni
 * bayi bot'a hiç yazmadıysa silent fail; admin paylaş pattern'i ile davet
 * akışındaki window açıldıysa mesaj iletilebilir).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "@/platform/whatsapp/send";

export type BayiOrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "rejected";

const STATUS_DATE_COL: Partial<Record<BayiOrderStatus, string>> = {
  confirmed: "confirmed_at",
  shipped: "shipped_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
};

const STATUS_MSG: Record<BayiOrderStatus, (orderShort: string) => string> = {
  pending: (n) => `🟡 Siparişiniz ${n} onay bekliyor.`,
  confirmed: (n) => `✅ Siparişiniz ${n} onaylandı. Yakında hazırlanıyor.`,
  preparing: (n) => `📦 Siparişiniz ${n} hazırlanıyor.`,
  shipped: (n) => `🚚 Siparişiniz ${n} kargoya verildi.`,
  delivered: (n) => `📍 Siparişiniz ${n} teslim edildi. Teşekkürler!`,
  cancelled: (n) => `❌ Siparişiniz ${n} iptal edildi.`,
  rejected: (n) => `❌ Siparişiniz ${n} reddedildi.`,
};

/**
 * Status transition uygula: order güncelle + history kayıt + WA notify.
 * Caller önce yetki kontrolü + valid transition'ı doğrulamalı.
 *
 * @returns true → başarılı, false → DB update hatası
 */
export async function transitionOrderStatus(
  sb: SupabaseClient,
  args: {
    orderId: string;
    fromStatus: BayiOrderStatus;
    toStatus: BayiOrderStatus;
    changedByUserId: string;
    reason?: string | null;
  },
): Promise<boolean> {
  const updatePatch: Record<string, string> = { status: args.toStatus };
  const dateCol = STATUS_DATE_COL[args.toStatus];
  if (dateCol) updatePatch[dateCol] = new Date().toISOString();
  if (args.toStatus === "rejected" && args.reason) {
    updatePatch.rejection_reason = args.reason;
  }

  const { data: updated, error: updErr } = await sb
    .from("bayi_dealer_orders")
    .update(updatePatch)
    .eq("id", args.orderId)
    .select("id, dealer_user_id, tenant_id")
    .single();

  if (updErr || !updated) {
    console.error("[transitionOrderStatus] update err:", updErr);
    return false;
  }

  await sb.from("bayi_dealer_order_status_history").insert({
    order_id: args.orderId,
    old_status: args.fromStatus,
    new_status: args.toStatus,
    changed_by_user_id: args.changedByUserId,
    reason: args.reason ?? null,
  });

  // WA notify (best-effort, async fire-and-forget)
  void notifyDealer(sb, updated.dealer_user_id, args.orderId, args.toStatus, args.reason);

  return true;
}

async function notifyDealer(
  sb: SupabaseClient,
  dealerUserId: string,
  orderId: string,
  status: BayiOrderStatus,
  reason?: string | null,
): Promise<void> {
  try {
    const { data: dealer } = await sb
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", dealerUserId)
      .maybeSingle();
    if (!dealer?.whatsapp_phone) return;
    const shortId = `#${orderId.slice(0, 8)}`;
    const base = STATUS_MSG[status](shortId);
    const body = reason ? `${base}\nSebep: ${reason}` : base;
    await sendText(dealer.whatsapp_phone, body);
  } catch (err) {
    console.error("[notifyDealer]", err);
  }
}

export async function notifyAdminsNewOrder(
  sb: SupabaseClient,
  tenantId: string,
  orderId: string,
  dealerName: string,
  totalAmount: number,
): Promise<void> {
  try {
    const { data: admins } = await sb
      .from("profiles")
      .select("whatsapp_phone")
      .eq("tenant_id", tenantId)
      .eq("role", "admin")
      .not("whatsapp_phone", "is", null);
    if (!admins?.length) return;
    const shortId = `#${orderId.slice(0, 8)}`;
    const amount = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(totalAmount);
    const body = `🔔 Yeni sipariş ${shortId}\n${dealerName} — ${amount}\nOnay bekleniyor.`;
    await Promise.all(
      admins
        .filter((a) => a.whatsapp_phone)
        .map((a) => sendText(a.whatsapp_phone, body).catch(() => { /* silent */ })),
    );
  } catch (err) {
    console.error("[notifyAdminsNewOrder]", err);
  }
}
