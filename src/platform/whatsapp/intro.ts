/**
 * Post-signup intro — "Value Before Signup" flow.
 *
 * Before asking for ANY user info, we demonstrate a real capability:
 *   1. Ask region (button/list)
 *   2. Ask property type (buttons)
 *   3. Ask listed_by (buttons)
 *   4. Query DB → show real market stats
 *   5. "Devam Et" → start onboarding (collect name, office, email etc.)
 *
 * This creates the "aha moment" before the user invests any effort.
 */

import type { WaContext } from "./types";
import { sendText } from "./send";
import {
  getOnboardingFlow,
  getOnboardingState,
  initOnboarding,
  sendOnboardingStep,
} from "./onboarding";
import { getServiceClient } from "@/platform/auth/supabase";

const INTRO_TENANTS = new Set(["emlak", "bayi", "restoran"]);

/**
 * Start the intro — value-first demo.
 *
 * Flow:
 *   1. Welcome text + yetenek listesi
 *   2. Bugünün sahibi ilanlarından 3-5 örnek listele (değer göster)
 *   3. "Menüye dön" mesajı ile flow kapat. Kullanıcı menüden:
 *      - 📬 Günlük İlan Takibi (kalıcı kriter kurmak için)
 *      - 🏠 Mülk Ekle, 🎯 Sunum Hazırla, vb.
 *
 * Profil bilgileri artık intro'da zorunlu değil — kullanıcı ihtiyaç
 * hissettiğinde /profilim ile doldurur. Onboarding_completed flag'i
 * intro bitişinde işaretlenir.
 */
export async function startIntro(ctx: WaContext): Promise<boolean> {
  if (!INTRO_TENANTS.has(ctx.tenantKey)) return false;

  if (ctx.tenantKey === "bayi") {
    return await startBayiIntro(ctx);
  }
  if (ctx.tenantKey === "restoran") {
    return await startRestoranIntro(ctx);
  }

  const supabase = getServiceClient();

  // Profil çek — firstName ve metadata için
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata, display_name")
    .eq("id", ctx.userId)
    .single();
  const displayName = (profile?.display_name as string) || ctx.userName || "";
  const firstName = displayName.split(/\s+/)[0] || "";

  // Sıcak karşılama — 3 mesaj, aralarında ~1.8 sn gecikme (sohbet havası).
  // 2026-05-07 öncesinde tek uzun blok + sendEmlakMenu (2 mesaj) idi;
  // okumayı zorlaştırıyordu. Yeni desen: kısa greeting → yetenekler → panel CTA.

  // Mesaj 1 — greeting
  const greeting = firstName
    ? `👋 Merhaba ${firstName}! ✨\n\nBen kişisel asistanınız UPU. 7/24 satışlarınızı artırmak için çalışacağım.`
    : `👋 Merhaba! ✨\n\nBen kişisel asistanınız UPU. 7/24 satışlarınızı artırmak için çalışacağım.`;
  await sendText(ctx.phone, greeting);

  await sleep(1800);

  // Mesaj 2 — kabiliyetler
  const capabilities =
    `🎯 *Yapabileceklerimden bazıları:*\n\n` +
    `✅ Her sabah Bodrum'daki sahibi ilanlarını filtreleyip size gönderirim\n` +
    `✅ Yapay zeka ile dakikalar içinde profesyonel sunum hazırlarım\n` +
    `✅ Sahibinden ilan yüklemenizi 30 dk'dan 3 dk'ya indiririm\n` +
    `✅ Sizin için web sayfası hazırlarım`;
  await sendText(ctx.phone, capabilities);

  await sleep(1800);

  // Mesaj 3 — Paneli Aç CTA (magic link mint inline; sendEmlakMenu yerine geçer)
  const { randomBytes } = await import("crypto");
  const { sendUrlButton } = await import("./send");
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const panelToken = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId, token: panelToken, expires_at: expiresAt,
  });
  const panelUrl = `${APP_URL}/tr/panel?t=${panelToken}`;
  const ctaMsg =
    `🖥 *Yönetim paneliniz hazır.*\n\n` +
    `Tüm sisteminizi yönetmek için panele gidin.\n\n` +
    `_Dilerseniz daha sonra komutlarla buradan da yönetebilirsiniz._`;
  await sendUrlButton(ctx.phone, ctaMsg, "🖥 Paneli Aç", panelUrl, { skipNav: true });

  // Mark onboarding completed
  const newMeta = {
    ...(profile?.metadata as Record<string, unknown> || {}),
    onboarding_completed: true,
    // Free-ride pattern (2026-05-05): emlak'ta tour kaldırıldı; intro
    // sonrası kullanıcı doğrudan komut menüsünü görür ve istediği yere gider.
    discovery_step: "completed",
  };
  await supabase.from("profiles").update({ metadata: newMeta }).eq("id", ctx.userId);

  return true;
}

/** Mesajlar arası sohbet havası için kısa gecikme. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bayi intro — koridor akışı: tek-tıklama Form'u Aç.
 *
 * 2 blok ardışık mesaj (WA gateway'in doğal sırası):
 *   1) UPU tanıtım + 5 yetenek vaadi (text)
 *   2) Form çağrısı + 📝 Form'u Aç CTA URL butonu (sendUrlButton)
 *
 * Eski "🚀 Başlayalım" reply button + ara onay mesajı kaldırıldı; koridor
 * mantığında ara onay yok, kullanıcı kayıt olduğu an akış başlar ve tek
 * tıklamayla web formunu açar.
 */
async function startBayiIntro(ctx: WaContext): Promise<boolean> {
  // Blok 1 — tanıtım
  const introMsg =
    `👋 Merhaba! Ben UPU, bayi yönetim asistanınız. 7/24 dağıtım operasyonunuzu kolaylaştıracağım.\n\n` +
    `*Yapabileceklerimden bazıları:*\n\n` +
    `• Her sabah günlük brifing — açık siparişler, kritik stok, vadesi gelen ödemeler özet\n` +
    `• Bayilerinizden gelen siparişleri telefonla çağırınca tek tıkla sisteme kaydederim\n` +
    `• Vadesi yaklaşan tahsilatlar için otomatik hatırlatma metni hazırlarım, onayınızla bayiye gönderirim\n` +
    `• Tüm bayilerinize tek tıkla kampanya duyurusu yaparım — %10 indirim, hızlı sipariş kampanyası gibi\n` +
    `• Stok kritik seviyeye düşünce uyarır, tedarikçi sipariş önerisi sunarım`;
  await sendText(ctx.phone, introMsg);

  // Blok 2 — magic link Form'u Aç
  const { randomBytes } = await import("crypto");
  const { sendUrlButton } = await import("./send");
  const sb = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: ctx.userId, token, expires_at: expiresAt,
  });
  const url = `https://retailai.upudev.nl/tr/bayi-profil?t=${token}`;
  const formMsg =
    `📋 *Şimdi sizi tanıyalım, lütfen formu doldurun.*\n\n` +
    `• Firma, yetkili, ofis adresi\n` +
    `• Brifing tercihi (sabah günlük özet)\n` +
    `• (Opsiyonel) Vergi, IBAN, kısa tanıtım\n\n` +
    `⏱ Tahmini 5 dk — tek formda hızlıca dolduracağız.`;
  await sendUrlButton(ctx.phone, formMsg, "📝 Form'u Aç", url, { skipNav: true });

  return true;
}

/**
 * Restoran intro — koridor akışı: tek-tıklama Form'u Aç.
 *
 * Bayi pattern aynısı: 2 mesaj (tanıtım + form CTA). Form save sonrası
 * sektör bazlı demo seed otomatik tetiklenir, kullanıcı bizim "örnek
 * restoran" verisi içinde tour'a başlar.
 */
async function startRestoranIntro(ctx: WaContext): Promise<boolean> {
  // Blok 1 — tanıtım
  const introMsg =
    `👋 Merhaba! Ben UPU, restoran asistanınız. Müdavim takibi, rezervasyon yönetimi ve sabah raporu için cep arkadaşınız.\n\n` +
    `*Yapabileceklerimden bazıları:*\n\n` +
    `• Her sabah günlük brifing — dünkü satış, bugün rezervasyonlar, doğum günü olan müdavimler, kritik stok\n` +
    `• Telefonla gelen rezervasyonları WA'dan tek akışta sisteme kaydederim — masa atama, özel istek, doğum günü notu\n` +
    `• Müdavim panosu — kim hangi sıklıkla geliyor, kim 2+ haftadır yok, kimin doğum günü\n` +
    `• Müşterilerinizi sadakat club'a davet ederim, doğum günlerinde sürpriz mesaj taslağı hazırlarım\n` +
    `• Mevcut kasanıza, mutfak sisteminize, muhasebecinize *dokunmuyorum* — sadece üzerine akıllı katman koyuyorum`;
  await sendText(ctx.phone, introMsg);

  // Blok 2 — magic link Form'u Aç
  const { randomBytes } = await import("crypto");
  const { sendUrlButton } = await import("./send");
  const sb = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: ctx.userId, token, expires_at: expiresAt,
  });
  const url = `https://restoranai.upudev.nl/tr/restoran-profil?t=${token}`;
  const formMsg =
    `📋 *Şimdi sizi tanıyalım, lütfen formu doldurun.*\n\n` +
    `• Restoran adı, sektör (kebap/cafe/catering), lokasyon\n` +
    `• Yetkili adı, brifing tercihi\n` +
    `• (Opsiyonel) muhasebe yazılımı, kapasite\n\n` +
    `⏱ Tahmini 2-3 dk. Form bitince size örnek bir restoran (Sultan Ahmet Kebabevi) yükleyeceğim — ` +
    `gerçek bağlantı kurulana kadar üzerinde çalışırsınız.`;
  await sendUrlButton(ctx.phone, formMsg, "📝 Form'u Aç", url, { skipNav: true });

  return true;
}

/**
 * Handle intro callback taps (yalnız emlak için).
 *
 * Callback ID formats:
 *   vf:start  → emlak onboarding form başlat
 *
 * Bayi callback'leri (vf:bayi_onay / vf:bayi_sonra / vf:start) 2026-05-04
 * koridor refactor'unda kaldırıldı — bayi intro artık tek-tıklama Form'u Aç
 * akışında, ara onay yok.
 *
 * (Eski emlak chain callback'leri vf:region/vf:type/vf:listing/vf:listed
 * 2026-04 startIntro emlak refactor'unda kaldırıldı — chain artık demo
 * arama linkiyle başlıyor, callback bağımlılığı yok.)
 */
export async function handleIntroCallback(ctx: WaContext, interactiveId: string): Promise<void> {
  const parts = interactiveId.split(":");
  if (parts[0] !== "vf") return;

  const step = parts[1];

  if (step === "start" && ctx.tenantKey !== "bayi") {
    // Emlak (ve diğer intro tenant'lar) — onboarding form
    const flow = getOnboardingFlow(ctx.tenantKey);
    if (flow) {
      await initOnboarding(ctx.userId, ctx.tenantId, ctx.tenantKey);
      const state = await getOnboardingState(ctx.userId);
      if (state) await sendOnboardingStep(ctx, state);
    } else {
      await sendText(ctx.phone, "✅ Hazırsın. Komutları kullanmaya başlayabilirsin.");
    }
    return;
  }
}
