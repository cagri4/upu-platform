/**
 * Sipariş status transition helper — audit log + bayi_orders update tek
 * çağrıda yapılır.
 *
 * Faz 4'te WA bildirim wiring buraya hook olarak eklenecek (TODO
 * emitOrderEvent).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface TransitionArgs {
  tenantId: string;
  orderId: string;
  toStatus: "pending" | "approved" | "rejected" | "preparing" | "shipped" | "delivered" | "cancelled";
  reason?: string | null;
  profileId: string | null;
}

export interface TransitionResult {
  ok: boolean;
  error?: string;
  previousStatus?: string;
}

export async function transitionOrderStatus(
  sb: SupabaseClient,
  args: TransitionArgs,
): Promise<TransitionResult> {
  const { tenantId, orderId, toStatus, reason, profileId } = args;

  // Mevcut durumu çek
  const { data: order } = await sb
    .from("bayi_orders")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "Sipariş bulunamadı." };

  const fromStatus = (order.status as string) || "pending";
  if (fromStatus === toStatus) {
    return { ok: false, error: `Sipariş zaten ${toStatus} durumunda.`, previousStatus: fromStatus };
  }

  // Faz 1.3 sadece pending → approved/rejected geçişine izin verir.
  // Diğer transition'lar Faz 3'te.
  if (fromStatus !== "pending" && (toStatus === "approved" || toStatus === "rejected")) {
    return {
      ok: false,
      error: `Sadece bekleyen siparişler onaylanır/reddedilir. Mevcut: ${fromStatus}`,
      previousStatus: fromStatus,
    };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: toStatus,
    updated_at: now,
  };
  if (toStatus === "approved") {
    patch.approved_at = now;
    patch.approved_by_profile_id = profileId;
  }
  if (toStatus === "rejected") {
    patch.rejected_at = now;
    patch.approved_by_profile_id = profileId;
    if (reason) patch.reject_reason = reason;
  }

  const { error: updErr } = await sb
    .from("bayi_orders")
    .update(patch)
    .eq("tenant_id", tenantId)
    .eq("id", orderId);

  if (updErr) {
    console.error("[order:transition:update]", updErr);
    return { ok: false, error: "Güncellenemedi.", previousStatus: fromStatus };
  }

  // Audit log
  const { error: histErr } = await sb.from("bayi_order_status_history").insert({
    tenant_id: tenantId,
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    reason: reason ?? null,
    changed_by_profile_id: profileId,
  });
  if (histErr) {
    console.error("[order:transition:history]", histErr);
  }

  // Faz 3 Sprint H: sipariş onaylandığında otomatik e-Fatura kes.
  // Hata olursa siparişi engellemez — fatura sonradan manuel kesilebilir.
  // Dinamik import: efatura/emit, transitionOrderStatus'un tüm yer
  // çağrıcılarına ek bundling yükü bindirmesin.
  if (toStatus === "approved") {
    try {
      const { emitInvoiceForOrder } = await import("@/platform/efatura/emit");
      const result = await emitInvoiceForOrder(sb, { tenantId, orderId });
      if (!result.ok && !result.skipped) {
        console.warn("[order:transition:invoice:failed]", result.errorMessage);
      }
    } catch (err) {
      console.error("[order:transition:invoice:error]", err);
    }
  }

  // Faz 4: sipariş status değişimi → in-app + WA bildirim (mock/canlı).
  // approved → bayiye onay; rejected → bayiye sebep notuyla red.
  // (created/shipped event'leri kendi tetik noktalarından emit edilir:
  //  siparis-olustur ve kargo endpoint'i.)
  if (toStatus === "approved" || toStatus === "rejected") {
    try {
      const { emitOrderEvent } = await import("@/platform/bayi/events/dispatcher");
      await emitOrderEvent(sb, {
        tenantId,
        orderId,
        kind: toStatus,
        extra: toStatus === "rejected" ? { reason: reason ?? undefined } : undefined,
      });
    } catch (err) {
      console.error("[order:transition:event:error]", err);
    }
  }

  return { ok: true, previousStatus: fromStatus };
}
