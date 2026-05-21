/**
 * Vitrinden yeni lead geldiğinde bayiye WA push.
 * sendNotification helper'ı kullanır (DB log + WA buton + DND/pref gate).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "@/platform/notifications/send-notification";

interface NewLeadPayload {
  leadId: string;
  customerName: string;
  customerPhone?: string | null;
  itemsSummary?: string | null;
  estTotal?: number | null;
  currency?: string | null;
  vitrineSlug?: string | null;
}

export async function notifyDealerNewLead(
  _sb: SupabaseClient,
  dealerUserId: string,
  payload: NewLeadPayload,
): Promise<void> {
  const title = "Yeni Müşteri Talebi";
  const lines = [
    `Vitrininden bir talep var: ${payload.customerName}`,
    payload.customerPhone ? `Tel: ${payload.customerPhone}` : null,
    payload.itemsSummary ? `Ürünler: ${payload.itemsSummary}` : null,
    payload.estTotal
      ? `Tutar tahmini: ${payload.estTotal.toLocaleString("tr-TR")} ${payload.currency || "TRY"}`
      : null,
    "Panel: /tr/bayi-musteri-talepleri",
  ].filter(Boolean) as string[];

  try {
    await sendNotification({
      userId: dealerUserId,
      type: "yeni_musteri_kayit",
      title,
      body: lines.join("\n"),
      payload: {
        click_target: "/tr/bayi-musteri-talepleri",
        related_entity_id: payload.leadId,
        related_entity_type: "bayi_lead",
        vitrine_slug: payload.vitrineSlug || undefined,
      },
    });
  } catch (err) {
    console.error("[notifyDealerNewLead]", err);
  }
}
