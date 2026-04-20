/**
 * Discovery Chain — guided first-use flow through killer features.
 *
 * After onboarding, each completed feature naturally suggests the next,
 * creating a chain of real product usage:
 *
 *   1. mulk_eklendi     → "Şimdi sunum hazırlayalım!"
 *   2. sunum_hazir      → "Piyasa taraması kuralım!"
 *   3. tarama_kuruldu   → "Hazırsın! Menüden devam et."
 *
 * Unlike gamification:
 *   - No XP, no streaks, no tiers
 *   - Each step produces a REAL output (sunum, link, web page)
 *   - User can leave chain anytime — it resumes on next relevant action
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons, sendText } from "./send";

export type DiscoveryStep = 0 | 1 | 2 | 3 | 4 | 5;

// Step names mapped to the event that advances them
const STEP_TRIGGERS: Record<string, DiscoveryStep> = {
  mulk_eklendi: 1,
  sunum_hazir: 2,
  tarama_kuruldu: 3,
  portfoy_tanitildi: 4,
};

// ── State helpers ────────────────────────────────────────────────────

export async function getDiscoveryStep(userId: string): Promise<DiscoveryStep> {
  const sb = getServiceClient();
  const { data } = await sb.from("profiles").select("metadata").eq("id", userId).maybeSingle();
  const meta = data?.metadata as Record<string, unknown> | null;
  return (meta?.discovery_step as DiscoveryStep) || 0;
}

async function setDiscoveryStep(userId: string, step: DiscoveryStep): Promise<void> {
  const sb = getServiceClient();
  const { data } = await sb.from("profiles").select("metadata").eq("id", userId).maybeSingle();
  const meta = (data?.metadata || {}) as Record<string, unknown>;
  await sb.from("profiles").update({
    metadata: { ...meta, discovery_step: step },
  }).eq("id", userId);
}

// ── Chain advancement ────────────────────────────────────────────────

/**
 * Called after a command completes. If the event matches the current
 * discovery step trigger, advance and show the next step's prompt.
 *
 * Returns true if a discovery message was sent (caller can skip
 * its own "success + back to menu" CTA if needed).
 */
export async function advanceDiscovery(
  userId: string,
  phone: string,
  eventName: string,
): Promise<boolean> {
  const currentStep = await getDiscoveryStep(userId);

  // Already completed chain or not at a step that matches this event
  if (currentStep >= 4) return false;

  const targetStep = STEP_TRIGGERS[eventName];
  if (targetStep === undefined) return false;

  // Only advance if this event matches the NEXT expected step
  if (targetStep !== currentStep + 1) return false;

  await setDiscoveryStep(userId, targetStep as DiscoveryStep);

  // Show next step prompt
  switch (targetStep) {
    case 1:
      // Just added first property → suggest sunum
      await sendButtons(phone,
        `🎉 *İlk mülkün eklendi!*\n\n` +
        `Şimdi bu mülk için müşterine gönderebileceğin etkileyici bir satış sunumu hazırlayalım.\n\n` +
        `Sunum hazır olduğunda sana özel bir link vereceğim — müşterine direkt gönder.`,
        [{ id: "cmd:sunum", title: "🎯 Sunum Hazırla" }],
      );
      return true;

    case 2:
      // Sunum done → suggest piyasa taraması
      await sendButtons(phone,
        `✨ *Sunumun hazır!*\n\n` +
        `Magic linki müşterine gönderebilirsin.\n\n` +
        `Şimdi piyasa taraması kuralım — senin vereceğin kriterlere göre her sabah bölgendeki yeni ilanları sana raporlayacağım. Bir fırsat kaçırma!`,
        [{ id: "cmd:takipEt", title: "📡 Tarama Kur" }],
      );
      return true;

    case 3:
      // Tarama done → introduce portfolio growth feature (WOW)
      await sendButtons(phone,
        `📡 *Taraman hazır!*\n\n` +
        `Her sabah bölgendeki yeni ilanları raporlayacağım.\n\n` +
        `*Ve dahası:* sabah raporunda *sahibinden olan ilanların sahiplerini* de göstereceğim. Bir ilana ilgilendiğini söylersen, sahibini bulup sana hazır bir AI mesaj taslağıyla tek tık iletişim fırsatı sunacağım.\n\n` +
        `Portföyünü büyütmek artık günde 5 dakikalık bir iş.`,
        [{ id: "disc:portfoy_ok", title: "🚀 Anladım" }],
      );
      return true;

    case 4:
      // Portfoy büyütme tanıtıldı → chain complete
      await sendText(phone,
        `🚀 *Harikasın!*\n\n` +
        `İlk mülkünü ekledin, sunum hazırladın, piyasa taramanı kurdun ve portföy büyütme özelliğini öğrendin.\n\n` +
        `Artık her sabah sana yeni fırsatlar gelecek. İstediğin zaman *"menü"* yazarak tüm komutlara ulaşabilirsin.\n\n` +
        `💡 Yeni ipuçları için *"ipucu"* yaz.`,
      );
      return true;
  }

  return false;
}

/**
 * Start the discovery chain — called from onboarding completion.
 * Sets step to 0 and sends the first prompt.
 */
export async function startDiscoveryChain(userId: string, phone: string, displayName?: string, officeName?: string, location?: string, email?: string, experienceYears?: string): Promise<void> {
  await setDiscoveryStep(userId, 0);

  let msg = "✅ *Kurulum tamamlandı!*\n\n";
  if (displayName) msg += `👤 ${displayName}\n`;
  if (officeName) msg += `🏢 ${officeName}\n`;
  if (location) msg += `📍 ${location}\n`;
  if (email) msg += `📧 ${email}\n`;
  if (experienceYears) msg += `📅 ${experienceYears} yıl tecrübe\n`;
  msg += `📱 ${phone}\n`;
  msg += `\nBu bilgileri daha sonra *"menü"* → *Sistem Komutları* → *Profilim* kısmından düzenleyebilirsiniz.\n`;
  msg += `\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `Şimdi devam ediyoruz! Hadi müşterine gönderebileceğin etkileyici bir sunum hazırlayalım — bunun için önce bir mülk ekleyelim.`;

  await sendButtons(phone, msg, [
    { id: "cmd:mulkekle", title: "🏠 Mülk Ekle" },
  ], { skipNav: true });
}
