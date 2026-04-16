/**
 * Employee Introduction Flow — post-signup tour before onboarding starts.
 *
 * After welcome message, users click through each virtual employee to learn
 * their role. Final button starts the tenant's onboarding flow.
 */

import type { WaContext } from "./types";
import { sendText, sendButtons } from "./send";
import {
  getOnboardingFlow,
  getOnboardingState,
  initOnboarding,
  sendOnboardingStep,
} from "./onboarding";

export type IntroStep = {
  key: string;          // step id used in callback (e.g. "sekreter")
  emoji: string;
  title: string;        // display name (e.g. "Sekreter")
  body: string;         // detailed description — fits under 1024 chars with buttons
  nextKey: string;      // next step key, or "start" for the final onboarding trigger
  nextButtonTitle: string;
};

export type IntroConfig = {
  tenantKey: string;
  introPrompt: string;
  firstStepKey: string;
  firstButtonTitle: string;
  steps: IntroStep[];
};

// ── Tenant intro configs ─────────────────────────────────────────────────

const emlakIntro: IntroConfig = {
  tenantKey: "emlak",
  introPrompt: "👥 Şimdi sanal elemanlarınızı tanıyalım.\n\nHer birine sırayla tıklayın — yeteneklerini öğrenin.",
  firstStepKey: "sekreter",
  firstButtonTitle: "👩‍💼 Sekreter",
  steps: [
    {
      key: "sekreter",
      emoji: "👩‍💼",
      title: "Sekreter",
      body:
        "👩‍💼 *Sekreter*\n\n" +
        "Ofisinizin akışını düzende tutan yardımcınız.\n\n" +
        "*Size her gün:*\n" +
        "• Günün randevularınızı ve gösterim planınızı hatırlatır\n" +
        "• Süresi biten sözleşme ve kira takibini yapar, önceden uyarır\n" +
        "• Geciken görevleri listeler, önceliklendirir\n" +
        "• Takip edeceğiniz müşteri aramalarını hatırlatır\n\n" +
        "Siz işinize odaklanırken o ajandanızı tutar.",
      nextKey: "satis",
      nextButtonTitle: "💼 Satış Destek",
    },
    {
      key: "satis",
      emoji: "💼",
      title: "Satış Destek",
      body:
        "💼 *Satış Destek*\n\n" +
        "Müşteri ilişkilerinizi kontrol altında tutan asistanınız.\n\n" +
        "*Size her gün:*\n" +
        "• Müşterilerinizi kayıt eder, arama/mesaj/gösterim geçmişini tutar\n" +
        "• Müşteri kriterlerine uygun mülkleri otomatik eşleştirir\n" +
        "• Sıcak müşterileri ve soğuk temasa geçilmesi gerekenleri ayırt eder\n" +
        "• Kriterleriniz değiştiğinde yeni uygun ilanları tarar, bildirir\n\n" +
        "Hiçbir müşteri fırsatı gözden kaçmaz.",
      nextKey: "portfoy",
      nextButtonTitle: "📁 Portföy Sor.",
    },
    {
      key: "portfoy",
      emoji: "📁",
      title: "Portföy Sorumlusu",
      body:
        "📁 *Portföy Sorumlusu*\n\n" +
        "Mülk portföyünüzü sürekli denetleyen uzmanınız.\n\n" +
        "*Size her gün:*\n" +
        "• Eksik bilgisi olan (m², oda, açıklama) mülkleri tespit eder, tamamlatır\n" +
        "• Uzun süredir satılmayan bayat ilanları işaretler\n" +
        "• Toplam portföy değerinizi ve ortalama satış sürenizi raporlar\n" +
        "• Hızlı satılması gerekenler için size strateji önerir\n\n" +
        "Portföyünüzün pazarda her zaman zinde kalmasını sağlar.",
      nextKey: "medya",
      nextButtonTitle: "📸 Medya Uzmanı",
    },
    {
      key: "medya",
      emoji: "📸",
      title: "Medya Uzmanı",
      body:
        "📸 *Medya Uzmanı*\n\n" +
        "Mülklerinizin tanıtımını üstlenen yaratıcı ekip üyeniz.\n\n" +
        "*Size her gün:*\n" +
        "• Fotoğrafı eksik ilanlarınızı tespit eder, hatırlatır\n" +
        "• İstediğiniz mülk için profesyonel sunum dosyası hazırlar\n" +
        "• Instagram/sosyal medya için hazır post metni ve görsel üretir\n" +
        "• Açıklama metinlerinizi müşteri odaklı olarak yeniler\n\n" +
        "Mülkleriniz sadece listede değil, vitrinde de görünür olur.",
      nextKey: "pazar",
      nextButtonTitle: "📊 Pazar Analisti",
    },
    {
      key: "pazar",
      emoji: "📊",
      title: "Pazar Analisti",
      body:
        "📊 *Pazar Analisti*\n\n" +
        "Bölgenizdeki piyasa hareketlerini sizden önce gören analistiniz.\n\n" +
        "*Size her gün:*\n" +
        "• Gecelik taramayla bölgenizde yeni çıkan ilanları sabah raporlar\n" +
        "• Mülkleriniz için piyasa ortalamasıyla fiyat karşılaştırması yapar\n" +
        "• Hangi mahallede fiyatların yükseldiğini/düştüğünü bildirir\n" +
        "• Belirlediğiniz kriterlere uyan yeni ilanları anında haber verir\n\n" +
        "Piyasa size değil, siz piyasaya bir adım önde olursunuz.",
      nextKey: "start",
      nextButtonTitle: "🚀 İlk Göreve Başla",
    },
  ],
};

const INTRO_CONFIGS: Record<string, IntroConfig> = {
  emlak: emlakIntro,
};

// ── Public API ───────────────────────────────────────────────────────────

export function getIntroConfig(tenantKey: string): IntroConfig | null {
  return INTRO_CONFIGS[tenantKey] || null;
}

/**
 * Start the intro flow after welcome message.
 * Returns true if intro was started; false if tenant has no intro config.
 * If false, caller should fall back to direct onboarding start.
 */
export async function startIntro(ctx: WaContext): Promise<boolean> {
  const config = INTRO_CONFIGS[ctx.tenantKey];
  if (!config) return false;

  await sendButtons(ctx.phone, config.introPrompt, [
    { id: `intro:${ctx.tenantKey}:${config.firstStepKey}`, title: config.firstButtonTitle },
  ]);
  return true;
}

/**
 * Handle a tap on an intro button.
 * Button id format: `intro:<tenantKey>:<stepKey>`
 * - stepKey matches a step in config → sends that step's body + next button
 * - stepKey === "start" → starts tenant onboarding flow
 */
export async function handleIntroCallback(ctx: WaContext, interactiveId: string): Promise<void> {
  const parts = interactiveId.split(":");
  if (parts.length !== 3) return;
  const [, tenantKey, stepKey] = parts;

  const config = INTRO_CONFIGS[tenantKey];
  if (!config) return;

  // Final step — launch onboarding
  if (stepKey === "start") {
    const flow = getOnboardingFlow(tenantKey);
    if (flow) {
      await initOnboarding(ctx.userId, ctx.tenantId, tenantKey);
      const state = await getOnboardingState(ctx.userId);
      if (state) await sendOnboardingStep(ctx, state);
    } else {
      await sendText(ctx.phone, "✅ Hazırsınız. Komutları kullanmaya başlayabilirsiniz.");
    }
    return;
  }

  const step = config.steps.find((s) => s.key === stepKey);
  if (!step) return;

  // Send detailed description + next button in one interactive message
  await sendButtons(ctx.phone, step.body, [
    { id: `intro:${tenantKey}:${step.nextKey}`, title: step.nextButtonTitle },
  ]);
}
