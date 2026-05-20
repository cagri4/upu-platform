/**
 * Bayi WA fallback responder — komut/menü/session yapısı kaldırıldı,
 * WA artık SADECE bildirim push + paneli aç linki kanalı.
 *
 * AI Eleman web panel'de yaşıyor (UpuAgentWidget). WA'ya text gelirse
 * (komut, menü, rastgele soru) bu fonksiyon "Paneli aç" magic link
 * gönderir.
 *
 * İstisnalar (router'da ayrıca handle edilir, buraya düşmez):
 *   - notif_view_* / notif_ack_* — notification button click handler
 *   - davet kabul akışı (statik /davet/<tenant>/<slug>) — panel route
 *   - üye-ol / giris-yap — handleWebpanelShared zaten panel link verir
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { getTenantPanelUrl } from "@/platform/auth/qr";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

const FALLBACK_PANEL_URL = "https://retailai.upudev.nl/tr/bayi-panel";

export async function bayiWaFallback(ctx: WaContext): Promise<void> {
  const sb = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // 7-gün magic link mint
  await sb.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expiresAt,
  });

  const panelBase = getTenantPanelUrl("bayi") || FALLBACK_PANEL_URL;
  const url = `${panelBase}?t=${token}`;

  await sendUrlButton(ctx.phone,
    `🤖 *UPU Bayi Paneli*\n\n` +
    `Tüm işlemler artık panelde yönetiliyor. Sipariş, cari, fatura, bayi yönetimi — hepsi tek yerden.\n\n` +
    `Sorularını panel'deki *UPU asistanına* yazabilirsin.`,
    "🖥 Paneli Aç",
    url,
    { skipNav: true },
  );
}
