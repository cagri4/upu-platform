/**
 * Discovery Chain — guided first-use flow through killer features.
 *
 * After onboarding, each completed feature naturally suggests the next,
 * creating a chain of real product usage. The state machine is per-tenant
 * because each SaaS has a different killer feature sequence:
 *
 *   emlak: mulk_eklendi → sunum_hazir → tarama_kuruldu → portfoy_tanitildi
 *   bayi:  firma_kaydedildi → urun_eklendi → bayi_davet_olusturuldu
 *           → kampanya_olusturuldu
 *
 * State is stored in profiles.metadata.discovery_steps[tenantKey] (number).
 * The legacy emlak-only key profiles.metadata.discovery_step is still read
 * as a fallback so existing in-flight users don't lose their progress.
 *
 * Unlike gamification:
 *   - No XP, no streaks, no tiers
 *   - Each step produces a REAL output (sunum, link, web page, kampanya)
 *   - User can leave chain anytime — it resumes on next relevant action
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons, sendText, sendUrlButton } from "./send";
import { randomBytes } from "crypto";

// Per-tenant event → step number map
const STEP_TRIGGERS_BY_TENANT: Record<string, Record<string, number>> = {
  emlak: {
    mulk_eklendi: 1,
    sunum_hazir: 2,
    tarama_kuruldu: 3,
    portfoy_tanitildi: 4,
  },
  bayi: {
    firma_kaydedildi: 1,
    urun_eklendi: 2,
    bayi_davet_olusturuldu: 3,
    kampanya_olusturuldu: 4,
  },
};

const MAX_STEP_BY_TENANT: Record<string, number> = {
  emlak: 4,
  bayi: 4,
};

const APP_URL_BY_TENANT: Record<string, string> = {
  emlak: "https://estateai.upudev.nl",
  bayi: "https://retailai.upudev.nl",
};

// ── State helpers ────────────────────────────────────────────────────

export async function getDiscoveryStep(userId: string, tenantKey: string): Promise<number> {
  const sb = getServiceClient();
  const { data } = await sb.from("profiles").select("metadata").eq("id", userId).maybeSingle();
  const meta = (data?.metadata || {}) as Record<string, unknown>;
  const steps = (meta.discovery_steps || {}) as Record<string, number>;
  if (typeof steps[tenantKey] === "number") return steps[tenantKey];
  // Backward-compat: emlak's old metadata.discovery_step
  if (tenantKey === "emlak" && typeof meta.discovery_step === "number") {
    return meta.discovery_step as number;
  }
  return 0;
}

async function setDiscoveryStep(userId: string, tenantKey: string, step: number): Promise<void> {
  const sb = getServiceClient();
  const { data } = await sb.from("profiles").select("metadata").eq("id", userId).maybeSingle();
  const meta = (data?.metadata || {}) as Record<string, unknown>;
  const steps = { ...((meta.discovery_steps || {}) as Record<string, number>), [tenantKey]: step };
  // Mirror to legacy emlak field while emlak callers still expect it.
  const newMeta: Record<string, unknown> = { ...meta, discovery_steps: steps };
  if (tenantKey === "emlak") newMeta.discovery_step = step;
  await sb.from("profiles").update({ metadata: newMeta }).eq("id", userId);
}

async function mintMagicToken(userId: string, ttlMs = 7 * 24 * 60 * 60 * 1000): Promise<string> {
  const sb = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await sb.from("magic_link_tokens").insert({ user_id: userId, token, expires_at: expiresAt });
  return token;
}

// ── Chain advancement ────────────────────────────────────────────────

/**
 * Called after a command completes. If the event matches the current
 * discovery step trigger for the given tenant, advance and show the
 * next step's prompt.
 *
 * Returns true if a discovery message was sent (caller can skip its own
 * "success + back to menu" CTA if needed).
 */
export async function advanceDiscovery(
  userId: string,
  tenantKey: string,
  phone: string,
  eventName: string,
): Promise<boolean> {
  const triggers = STEP_TRIGGERS_BY_TENANT[tenantKey];
  if (!triggers) return false;
  const maxStep = MAX_STEP_BY_TENANT[tenantKey] ?? 0;
  const currentStep = await getDiscoveryStep(userId, tenantKey);

  if (currentStep >= maxStep) return false;

  const targetStep = triggers[eventName];
  if (targetStep === undefined) return false;

  if (targetStep !== currentStep + 1) return false;

  await setDiscoveryStep(userId, tenantKey, targetStep);

  if (tenantKey === "emlak") return sendEmlakStepPrompt(userId, phone, targetStep);
  if (tenantKey === "bayi") return sendBayiStepPrompt(userId, phone, targetStep);
  return false;
}

// ── Emlak prompts (preserved verbatim) ───────────────────────────────

async function sendEmlakStepPrompt(_userId: string, phone: string, step: number): Promise<boolean> {
  switch (step) {
    case 1:
      await sendButtons(phone,
        `🎉 *İlk mülkün eklendi!*\n\n` +
        `Şimdi bu mülk için müşterine gönderebileceğin etkileyici bir satış sunumu hazırlayalım.\n\n` +
        `Sunum hazır olduğunda sana özel bir link vereceğim — müşterine direkt gönder.`,
        [{ id: "cmd:sunum", title: "🎯 Sunum Hazırla" }],
      );
      return true;
    case 2:
      await sendButtons(phone,
        `✨ *Sunumun hazır!*\n\n` +
        `Magic linki müşterine gönderebilirsin.\n\n` +
        `Şimdi piyasa taraması kuralım — senin vereceğin kriterlere göre her sabah bölgendeki yeni ilanları sana raporlayacağım. Bir fırsat kaçırma!`,
        [{ id: "cmd:takipEt", title: "📡 Tarama Kur" }],
      );
      return true;
    case 3:
      await sendButtons(phone,
        `📡 *Taraman hazır!*\n\n` +
        `Her sabah bölgendeki yeni ilanları raporlayacağım.\n\n` +
        `*Ve dahası:* sabah raporunda *sahibinden olan ilanların sahiplerini* de göstereceğim. Bir ilana ilgilendiğini söylersen, sahibini bulup sana hazır bir AI mesaj taslağıyla tek tık iletişim fırsatı sunacağım.\n\n` +
        `Portföyünü büyütmek artık günde 5 dakikalık bir iş.`,
        [{ id: "disc:portfoy_ok", title: "🚀 Anladım" }],
      );
      return true;
    case 4:
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

// ── Bayi prompts ─────────────────────────────────────────────────────

async function sendBayiStepPrompt(userId: string, phone: string, step: number): Promise<boolean> {
  const appUrl = APP_URL_BY_TENANT.bayi;
  switch (step) {
    case 1: {
      // Firma profili tamamlandı → "Ürün Ekle" magic link
      const token = await mintMagicToken(userId);
      const url = `${appUrl}/tr/bayi-urun-ekle?t=${token}`;
      await sendUrlButton(phone,
        `✅ *Firma profiliniz hazır!*\n\n` +
        `Şimdi ilk ürününüzü kataloğa ekleyelim — bayilerinizin sipariş vereceği ürün.\n\n` +
        `Foto, fiyat ve stok bilgisi yeterli; ileride dilediğiniz zaman güncellersiniz.`,
        "📦 Ürün Ekle",
        url,
        { skipNav: true },
      );
      return true;
    }
    case 2: {
      // Ürün eklendi → bayi davet WA komutu butonu (mevcut /bayidavet)
      await sendButtons(phone,
        `🎉 *İlk ürün kataloğunuzda!*\n\n` +
        `Şimdi bayilerinizi sisteme davet edelim — onlara çoklu kullanımlık bir kayıt linki üretiyorum.\n\n` +
        `Linki bayilerinize gönderdiğinizde her biri tek tıkla kayıt olup ürünlerinizi görüp sipariş verebilir.`,
        [{ id: "cmd:bayidavet", title: "🏪 Bayi Davet Linki" }],
      );
      return true;
    }
    case 3: {
      // Bayi davet linki üretildi → kampanya magic link
      const token = await mintMagicToken(userId);
      const url = `${appUrl}/tr/bayi-kampanya?t=${token}`;
      await sendUrlButton(phone,
        `📢 *Davet linki hazır!*\n\n` +
        `Bayileriniz kayıt olmaya başladığında ilk siparişler düşmeye başlayacak.\n\n` +
        `Tetiklemek için bir kampanya başlatalım — örn: %10 indirim, hızlı sipariş, sınırlı süre. ` +
        `Bayilerinize otomatik bildirim gidecek.`,
        "📣 Kampanya Oluştur",
        url,
        { skipNav: true },
      );
      return true;
    }
    case 4: {
      // Kapanış — 3 buton
      await sendButtons(phone,
        `🚀 *Hazırsınız!*\n\n` +
        `Firma profilinizi tamamladınız, ürün eklediniz, bayi davet linkiniz çalışıyor ve ilk kampanyanız aktif.\n\n` +
        `Artık günlük rutininiz:\n` +
        `• 🌅 Sabah brifinginiz WhatsApp'a düşer\n` +
        `• 🛒 Bayi siparişleri anlık bildirim olarak gelir\n` +
        `• 🖥 Web panelden tüm ağı yönetirsiniz\n\n` +
        `İstediğiniz zaman *"menü"* yazarak tüm komutlara erişebilirsiniz.`,
        [
          { id: "cmd:webpanel", title: "🖥 Web Panel" },
          { id: "cmd:calisanekle", title: "👥 Çalışan Davet" },
          { id: "cmd:menu", title: "📋 Ana Menü" },
        ],
      );
      return true;
    }
  }
  return false;
}

// ── Chain start (emlak — preserved API) ──────────────────────────────

/**
 * Start the emlak discovery chain — called from emlak's onboarding finish.
 * Sets step to 0 and sends the first prompt with mülk ekle CTA.
 *
 * Bayi has its own start path inlined in bayi/onboarding-flow.ts; it
 * doesn't need a wrapper because the first prompt is a magic-link form.
 */
export async function startDiscoveryChain(userId: string, phone: string, displayName?: string, officeName?: string, location?: string, email?: string, experienceYears?: string): Promise<void> {
  await setDiscoveryStep(userId, "emlak", 0);

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

/**
 * Start the bayi discovery chain — called from bayi's onboarding finish.
 * Sets step to 0 and sends the first prompt: a magic link to the firma
 * profil web form (5 zorunlu alan).
 */
export async function startBayiDiscoveryChain(userId: string, phone: string, companyName?: string): Promise<void> {
  await setDiscoveryStep(userId, "bayi", 0);

  const token = await mintMagicToken(userId);
  const url = `${APP_URL_BY_TENANT.bayi}/tr/bayi-profil?t=${token}`;

  let header = "✅ *Kurulum tamamlandı!*";
  if (companyName) header += `\n🏢 ${companyName}`;

  await sendUrlButton(phone,
    `${header}\n\n` +
    `Şimdi firma profilinizi tamamlayalım — vergi, iletişim ve faturalama bilgileri (5 zorunlu alan, 90 saniye).\n\n` +
    `Eksik bıraktığınız alanları sonra profil menüsünden tamamlayabilirsiniz.`,
    "📝 Firma Profili",
    url,
    { skipNav: true },
  );
}
