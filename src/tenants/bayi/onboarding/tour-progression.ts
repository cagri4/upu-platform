/**
 * Bayi AI-led tour ilerleme middleware.
 *
 * Komut başarılı çalıştıktan sonra router çağırır. Mevcut discovery_step
 * + komuta göre uygun event'i seçer ve advanceDiscovery tetikler. Bu da
 * bir sonraki step prompt'unu (chain.sendBayiStepPrompt) WA'ya gönderir.
 *
 * Adım haritası:
 *   2 (demo_seed_yuklendi) → bayidurum/bayilerim → tour_bayilerim_done → 3
 *   3 → bayidurum (kritik bayi)              → tour_kritik_bayi_done → 4
 *   4 → urunler                              → tour_urunler_done     → 5
 *   5 → fiyatliste                           → tour_urun_detay_done  → 6
 *   6 → siparisolustur                       → tour_siparis_done     → 7
 *   7 → ozet/sabah                           → tour_sabah_done       → 8
 *   8 → tahsilat                             → tour_tahsilat_done    → 9 (completed)
 *
 * Sırayı izlemeyen kullanıcı komut çalıştırırsa tour ilerlemez (event
 * mevcut step+1'le eşleşmediği için advanceDiscovery early-return). Bu
 * doğru davranış — kullanıcı serbest mod hissedebilir, tour yine takılmaz.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { getDiscoveryStep, advanceDiscovery, setDiscoveryStep } from "@/platform/whatsapp/discovery-chain";
import { sendButtons } from "@/platform/whatsapp/send";

// step → komut → event eşleştirmesi.
// Bir step'te birden fazla command kabul edilebilir (alias karşılığı).
const STEP_COMMAND_EVENT: Record<number, Record<string, string>> = {
  2: { bayidurum: "tour_bayilerim_done" },
  3: { bayidurum: "tour_kritik_bayi_done" },
  4: { urunler: "tour_urunler_done" },
  5: { fiyatliste: "tour_urun_detay_done" },
  6: { siparisolustur: "tour_siparis_done" },
  7: { ozet: "tour_sabah_done" },
  8: { tahsilat: "tour_tahsilat_done", tahsilatbildir: "tour_tahsilat_done" },
};

export async function advanceBayiTourIfMatched(ctx: WaContext, resolvedCommand: string): Promise<void> {
  const step = await getDiscoveryStep(ctx.userId, "bayi");
  if (step < 2 || step >= 9) return; // tour aktif değil veya bitti

  const stepMap = STEP_COMMAND_EVENT[step];
  if (!stepMap) return;
  const event = stepMap[resolvedCommand];
  if (!event) return;

  await advanceDiscovery(ctx.userId, "bayi", ctx.phone, event);
}

/**
 * Kullanıcı "Tour'u Atla" butonuna tıkladığında çağrılır. discovery_step
 * direkt 9'a (completed) atılır ve kapanış mesajı gönderilir. Free-ride
 * mode etkinleşir.
 */
export async function skipBayiTour(userId: string, phone: string): Promise<void> {
  await setDiscoveryStep(userId, "bayi", 9);
  await sendButtons(phone,
    `⏭ *Tour atlandı.*\n\n` +
    `Sistemi kendi başınıza keşfedin. Yardım için *yardim*, tüm komutlar için *menu* yazın.`,
    [
      { id: "cmd:menu", title: "📋 Ana Menü" },
      { id: "cmd:webpanel", title: "🖥 Web Panel" },
    ],
  );
}
