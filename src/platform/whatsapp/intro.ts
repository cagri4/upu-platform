/**
 * Post-signup intro — single-assistant welcome then hand off to onboarding.
 *
 * No more 5-employee tour. A short assistant greeting + "Başla" button that
 * launches the tenant's onboarding flow.
 */

import type { WaContext } from "./types";
import { sendButtons, sendText } from "./send";
import {
  getOnboardingFlow,
  getOnboardingState,
  initOnboarding,
  sendOnboardingStep,
} from "./onboarding";

// Tenants that use the intro flow. Others go straight to onboarding.
const INTRO_TENANTS = new Set(["emlak"]);

/**
 * Start the intro. Returns true if a button was sent (caller should NOT
 * start onboarding itself); false if no intro applies (caller should).
 */
export async function startIntro(ctx: WaContext): Promise<boolean> {
  if (!INTRO_TENANTS.has(ctx.tenantKey)) return false;

  await sendButtons(ctx.phone,
    `👋 *Merhaba!*\n\n` +
    `Ben senin kişisel asistanın UPU. 7/24 satışlarını artırmak için çalışacağım.\n\n` +
    `*Senin için neler yaparım?*\n\n` +
    `• Sisteme eklediğin mülkler için etkileyici, satış hedefli sunumlar hazırlarım\n` +
    `• Yetkilendirme sözleşmesini doldurur, e-imzaya hazır ederim\n` +
    `• Senin vereceğin kriterlere göre piyasayı tararım, yeni fırsatları raporlarım\n` +
    `• Bütün portföyünü ve bilgilerini tek seferde paylaşabileceğin, sana özel bir web sayfası yaparım\n` +
    `• Müşteri takibi için hatırlatmalar tutar, zamanında iletirim\n` +
    `• Mülklerin için satış hedefli müşteri konuşmaları hazırlarım\n` +
    `• Mülklerin için AI destekli ilan açıklaması yazarım\n` +
    `• Instagram ve sosyal medya için hashtag'li paylaşım metni üretirim\n\n` +
    `Önce seni tanıyayım — kısa birkaç soru.`,
    [{ id: `intro:${ctx.tenantKey}:start`, title: "🚀 Başlayalım" }],
  );
  return true;
}

/**
 * Handle intro button tap. Only one button now: `intro:<tenant>:start`
 * which launches the onboarding flow.
 */
export async function handleIntroCallback(ctx: WaContext, interactiveId: string): Promise<void> {
  const parts = interactiveId.split(":");
  if (parts.length !== 3) return;
  const [, tenantKey] = parts;

  const flow = getOnboardingFlow(tenantKey);
  if (flow) {
    await initOnboarding(ctx.userId, ctx.tenantId, tenantKey);
    const state = await getOnboardingState(ctx.userId);
    if (state) await sendOnboardingStep(ctx, state);
  } else {
    await sendText(ctx.phone, "✅ Hazırsın. Komutları kullanmaya başlayabilirsin.");
  }
}
