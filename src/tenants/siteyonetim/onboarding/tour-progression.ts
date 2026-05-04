/**
 * Siteyönetim AI-led tour ilerleme middleware.
 *
 * Komut başarılı çalıştıktan sonra router çağırır. Mevcut discovery_step
 * + komuta göre uygun event'i seçer ve advanceDiscovery tetikler. Bu da
 * bir sonraki step prompt'unu (sendSiteyonetimStepPrompt) WA'ya gönderir.
 *
 * Adım haritası:
 *   1 (setup_complete) → rapor      → tour_rapor_done       → 2
 *   2                  → aidat      → tour_aidat_done       → 3
 *   3                  → borc/borcum → tour_borc_done       → 4
 *   4                  → bakim      → tour_bakim_done       → 5
 *   5                  → ariza      → tour_ariza_done       → 6
 *   6                  → gelir_gider → tour_gelirgider_done → 7
 *   7                  → binakodu   → tour_binakodu_done    → 8 (completed)
 *
 * Sırayı izlemeyen kullanıcı komut çalıştırırsa tour ilerlemez (event
 * mevcut step+1'le eşleşmediği için advanceDiscovery early-return). Bu
 * doğru davranış — kullanıcı serbest mod hissedebilir, tour yine takılmaz.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { getDiscoveryStep, advanceDiscovery, setDiscoveryStep } from "@/platform/whatsapp/discovery-chain";
import { sendButtons } from "@/platform/whatsapp/send";

const STEP_COMMAND_EVENT: Record<number, Record<string, string>> = {
  1: { rapor: "tour_rapor_done" },
  2: { aidat: "tour_aidat_done" },
  3: { borc: "tour_borc_done", borcum: "tour_borc_done" },
  4: { bakim: "tour_bakim_done" },
  5: { ariza: "tour_ariza_done" },
  6: { gelir_gider: "tour_gelirgider_done" },
  7: { binakodu: "tour_binakodu_done" },
};

export async function advanceSiteyonetimTourIfMatched(ctx: WaContext, resolvedCommand: string): Promise<void> {
  const step = await getDiscoveryStep(ctx.userId, "siteyonetim");
  if (step < 1 || step >= 8) return; // tour aktif değil veya bitti

  const stepMap = STEP_COMMAND_EVENT[step];
  if (!stepMap) return;
  const event = stepMap[resolvedCommand];
  if (!event) return;

  await advanceDiscovery(ctx.userId, "siteyonetim", ctx.phone, event);
}

/**
 * Kullanıcı "Tour'u Atla" butonuna tıkladığında çağrılır. discovery_step
 * direkt 8'e (completed) atılır ve kapanış mesajı gönderilir. Free-ride
 * mode etkinleşir.
 */
export async function skipSiteyonetimTour(userId: string, phone: string): Promise<void> {
  await setDiscoveryStep(userId, "siteyonetim", 8);
  await sendButtons(phone,
    `⏭ *Tour atlandı.*\n\n` +
    `Sistemi kendi başınıza keşfedin. Yardım için *yardim*, tüm komutlar için *menu* yazın.`,
    [
      { id: "cmd:menu", title: "📋 Ana Menü" },
      { id: "cmd:binakodu", title: "🔑 Bina Kodu" },
    ],
  );
}
