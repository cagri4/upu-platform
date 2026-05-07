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

const INTRO_TENANTS = new Set(["emlak", "bayi", "restoran", "siteyonetim", "otel", "market"]);

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
  if (ctx.tenantKey === "siteyonetim") {
    return await startSiteyonetimIntro(ctx);
  }
  if (ctx.tenantKey === "otel") {
    return await startOtelIntro(ctx);
  }
  if (ctx.tenantKey === "market") {
    const { startMarketIntro } = await import("@/tenants/market/intro");
    return await startMarketIntro(ctx);
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
    `✅ Her sabah yeni sahibi ilanları ile portföyünüzü büyütmenize yardım ederim\n` +
    `✅ Yapay zeka ile dakikalar içinde profesyonel sunum hazırlarım\n` +
    `✅ sahibindenCom ilan yüklemenizi 30 dk'dan 3 dk'ya indiririm\n` +
    `✅ Sizin için web sayfası hazırlarım`;
  await sendText(ctx.phone, capabilities);

  await sleep(1800);

  // Mesaj 3 — Paneli Aç CTA (evergreen URL — eski mesajlardan tıklansa da çalışır)
  const { sendUrlButton } = await import("./send");
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
  const panelUrl = `${APP_URL}/api/panel/evergreen?phone=${encodeURIComponent(ctx.phone)}`;
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
 * Bayi intro — warm welcome 3 mesaj (2026-05-07 emlak replikasyonu).
 *
 * Sohbet havası için 3 mesaj 1.8 sn aralıklarla:
 *   1) Selamlama + core promise (firstName ile)
 *   2) "Yapabileceklerim" 4 madde
 *   3) Form çağrısı + 📝 Form'u Aç CTA URL
 *
 * Tüm metinler formal "siz" + "yapay zeka" (tutarlı tone).
 */
async function startBayiIntro(ctx: WaContext): Promise<boolean> {
  // firstName — profile.metadata.firma_profili.yetkili_adi öncelik,
  // sonra display_name. Bilinmiyorsa selamlama generic kalır.
  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, metadata")
    .eq("id", ctx.userId)
    .maybeSingle();
  const meta = (profile?.metadata || {}) as Record<string, unknown>;
  const firmaProfili = (meta.firma_profili as { yetkili_adi?: string } | undefined);
  const fullName = firmaProfili?.yetkili_adi || profile?.display_name || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : "";

  // Mesaj 1 — selamlama + core promise
  const greet = firstName ? `👋 Merhaba ${firstName}! ✨` : `👋 Merhaba! ✨`;
  await sendText(ctx.phone,
    `${greet}\n\n` +
    `Ben kişisel asistanınız UPU. 7/24 tahsilatlarınızı ve sipariş operasyonunuzu kolaylaştıracağım.`,
  );
  await sleep(1800);

  // Mesaj 2 — yetenekler 4 madde
  await sendText(ctx.phone,
    `🎯 *Yapabileceklerimden bazıları:*\n\n` +
    `✅ Yeni bayi başvurularınızı telefonla onaylayıp sisteme eklerim\n` +
    `✅ Vadesi gelen tahsilatlarınız için hatırlatma metni hazırlar, onayınızla bayiye gönderirim\n` +
    `✅ Bayi siparişlerinizi WhatsApp'tan tek akışta sisteme kaydederim\n` +
    `✅ Tüm bayilerinize tek tıkla kampanya duyurusu yaparım`,
  );
  await sleep(1800);

  // Mesaj 3 — magic link + Form/Panel CTA
  const { randomBytes } = await import("crypto");
  const { sendUrlButton } = await import("./send");
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
 * Restoran intro — warm welcome 3 mesaj (2026-05-07 emlak replikasyonu).
 *
 * Sohbet havası için 3 mesaj 1.8 sn aralıklarla:
 *   1) Selamlama + core promise (firstName ile)
 *   2) "Yapabileceklerim" 4 madde
 *   3) Form çağrısı + 📝 Form'u Aç CTA URL
 *
 * Form save sonrası /api/restoran-profil/save'in `sendWarmWelcome`
 * fonksiyonu ikinci bir 3-mesaj seti gönderir (Mesaj 3 = 🖥 Paneli Aç).
 *
 * Tüm metinler formal "siz" — gold standard pattern.
 */
async function startRestoranIntro(ctx: WaContext): Promise<boolean> {
  // firstName: profile.metadata.display_name | profile.display_name
  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, metadata")
    .eq("id", ctx.userId)
    .maybeSingle();
  const fullName = (profile?.display_name as string) || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : "";

  // Mesaj 1 — selamlama + core promise
  const greet = firstName ? `👋 Merhaba ${firstName}! ✨` : `👋 Merhaba! ✨`;
  await sendText(ctx.phone,
    `${greet}\n\n` +
    `Ben kişisel asistanınız UPU. 7/24 siparişlerinizi hızlandırıp müdavim ilişkinizi güçlendireceğim.`,
  );
  await sleep(1800);

  // Mesaj 2 — 4 madde
  await sendText(ctx.phone,
    `🎯 *Yapabileceklerimden bazıları:*\n\n` +
    `✅ Sabah dünkü satış + bugün rezervasyon brifinginizi hazırlarım\n` +
    `✅ Telefonla gelen rezervasyonlarınızı masa atamayla sisteme kaydederim\n` +
    `✅ Müdavim panosu — kim 2+ haftadır yok, kimin doğum günü olduğunu size bildiririm\n` +
    `✅ Sadakat club daveti + sürpriz mesaj taslaklarını hazırlarım`,
  );
  await sleep(1800);

  // Mesaj 3 — magic link Form'u Aç (formal "siz")
  const { randomBytes } = await import("crypto");
  const { sendUrlButton } = await import("./send");
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: ctx.userId, token, expires_at: expiresAt,
  });
  const url = `https://restoranai.upudev.nl/tr/restoran-profil?t=${token}`;
  const formMsg =
    `📋 *Sizi tanıyalım, lütfen formu doldurun.*\n\n` +
    `• Restoran adı, işletme tipi (kebap/cafe/catering/tatlıcı), lokasyon\n` +
    `• Yetkili adı, brifing tercihi\n` +
    `• (Opsiyonel) muhasebe yazılımı, kapasite\n\n` +
    `⏱ Tahmini 2-3 dk. Form bitince örnek bir restoran (Sultan Ahmet Kebabevi) yükleyeceğim — ` +
    `gerçek bağlantı kurulana kadar üzerinde çalışırsınız.`;
  await sendUrlButton(ctx.phone, formMsg, "📝 Form'u Aç", url, { skipNav: true });

  return true;
}

/**
 * Siteyönetim intro — warm welcome 3 mesaj (2026-05-07 emlak replikasyonu).
 *
 * Mesaj 1 greeting + core promise → sleep 1.8 sn → Mesaj 2 4 madde →
 * sleep 1.8 sn → arka planda otomatik bina + demo seed yükle →
 * Mesaj 3 magic link "Paneli Aç". Kullanıcı panele girdiğinde KPI'lar
 * önceden dolu görünür (boş "Hoşgeldin, 0/0/0/0/0" karşılama yok).
 *
 * Mevcut WA onboarding 4-soru flow (siteyonetimOnboardingFlow) bu yolda
 * tetiklenmez — gateway startIntro=true dönerse onboarding skip eder.
 * Onboarding flow registered kalıyor; legacy invite_codes (6-hex) yolu
 * için fallback olarak çalışır.
 */
async function startSiteyonetimIntro(ctx: WaContext): Promise<boolean> {
  const sb = getServiceClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, metadata, tenant_id")
    .eq("id", ctx.userId)
    .maybeSingle();
  const fullName = profile?.display_name || ctx.userName || "";
  const firstName = fullName ? fullName.split(/\s+/)[0] : "";

  // Mesaj 1 — selamlama + core promise (formal "siz")
  const greet = firstName ? `👋 Merhaba ${firstName}! ✨` : `👋 Merhaba! ✨`;
  await sendText(ctx.phone,
    `${greet}\n\n` +
    `Ben kişisel asistanınız UPU. 7/24 sakin iletişiminizi ve aidat takibinizi düzene sokacağım.`,
  );
  await sleep(1800);

  // Mesaj 2 — 4 madde (replikasyon brief'inden)
  await sendText(ctx.phone,
    `🎯 *Yapabileceklerimden bazıları:*\n\n` +
    `✅ Açık şikayet/talep özetinizi her sabah getiririm\n` +
    `✅ Aidat ödenmemiş daireler için hatırlatma metni hazırlarım\n` +
    `✅ Etkinlik + duyuru mesajlarınızı yazar, onayınızla gönderirim\n` +
    `✅ Personel görev atama + tamamlanma bildirimleri yaparım`,
  );
  await sleep(1800);

  // Arka planda: bina yoksa otomatik yarat + demo seed yükle.
  // Idempotent — bina zaten varsa veya seed atılmışsa skip eder.
  const tenantId = profile?.tenant_id || ctx.tenantId;
  let buildingId: string | null = null;
  try {
    const { data: existing } = await sb
      .from("sy_buildings")
      .select("id")
      .eq("manager_id", ctx.userId)
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      buildingId = existing.id as string;
    } else {
      const { generateAccessCode } = await import("@/tenants/siteyonetim/commands/helpers");
      const buildingName = firstName ? `${firstName} Apartmanı` : "Apartmanım";
      const { data: created } = await sb
        .from("sy_buildings")
        .insert({
          tenant_id: tenantId,
          name: buildingName,
          manager_id: ctx.userId,
          access_code: generateAccessCode(),
        })
        .select("id")
        .single();
      buildingId = (created?.id as string | undefined) ?? null;
    }

    if (buildingId) {
      const { seedSiteyonetimDemoData } = await import("@/tenants/siteyonetim/demo/seed");
      await seedSiteyonetimDemoData(sb, tenantId, ctx.userId, buildingId);
    }
  } catch (err) {
    console.error("[siteyonetim:intro] demo seed err:", err);
    // Hata durumunda mesaj 3'ü atla — kullanıcı yine de panele giderse
    // boş bir bina görür. Ana flow bozulmaz.
  }

  // Mesaj 3 — Paneli Aç magic link
  const { randomBytes } = await import("crypto");
  const { sendUrlButton } = await import("./send");
  const APP_URL = "https://residenceai.upudev.nl";
  const panelToken = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: ctx.userId, token: panelToken, expires_at: expiresAt,
  });
  const panelUrl = `${APP_URL}/tr/site?t=${panelToken}`;
  const ctaMsg =
    `🖥 *Yönetim paneliniz hazır.*\n\n` +
    `Tüm sisteminizi yönetmek için panele gidin.\n\n` +
    `_Dilerseniz daha sonra komutlarla buradan da yönetebilirsiniz._`;
  await sendUrlButton(ctx.phone, ctaMsg, "🖥 Paneli Aç", panelUrl, { skipNav: true });

  // Profil metadata: onboarding tamamlandı + intro tetik tekrar etmesin
  const newMeta = {
    ...(profile?.metadata as Record<string, unknown> || {}),
    onboarding_completed: true,
  };
  await sb.from("profiles").update({ metadata: newMeta }).eq("id", ctx.userId);

  return true;
}

/**
 * Otel intro — sıcak karşılama 3-mesaj pattern (formal "siz", emlak şablonu).
 *
 * Mesaj 1 (greeting):     "Ben kişisel asistanınız UPU. Doluluğunuzu ve gelirinizi artırmak için çalışacağım."
 * sleep 1800
 * Mesaj 2 (4 yetenek):    sabah brifing / telefonla rez / loyalty taslağı / açık ödeme uyarı
 * sleep 1800
 * Mesaj 3 (panel CTA):    "🖥 Yönetim paneliniz hazır." + 7-gün magic link
 *
 * Onboarding skip — çünkü misafirler için onboarding zaten yok (route.ts'te
 * skipOnboarding) ve sahip için onboarding mevcut otel onboarding flow ile
 * ayrı tetikleniyor (4-step: hotel_name/location/room_count/briefing).
 * Bu intro o flow tamamlandıktan SONRA geliyor — yani sahibi tanıdık,
 * panel link gönderme aşaması.
 */
async function startOtelIntro(ctx: WaContext): Promise<boolean> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata, display_name")
    .eq("id", ctx.userId)
    .single();
  const displayName = (profile?.display_name as string) || ctx.userName || "";
  const firstName = displayName.split(/\s+/)[0] || "";

  // Mesaj 1 — greeting (formal "siz")
  const greeting = firstName
    ? `👋 Merhaba ${firstName}! ✨\n\nBen kişisel asistanınız UPU. 7/24 doluluğunuzu ve gelirinizi artırmak için çalışacağım.`
    : `👋 Merhaba! ✨\n\nBen kişisel asistanınız UPU. 7/24 doluluğunuzu ve gelirinizi artırmak için çalışacağım.`;
  await sendText(ctx.phone, greeting);

  await sleep(1800);

  // Mesaj 2 — 4 kabiliyet
  const capabilities =
    `🎯 *Yapabileceklerimden bazıları:*\n\n` +
    `✅ Sabah doluluk + bugün çek-in/çek-out brifinginizi hazırlarım\n` +
    `✅ Telefonla gelen rezervasyonlarınızı tek akışta sisteme kaydederim\n` +
    `✅ Sürekli müşterileriniz için doğum günü/sezon mesajı taslakları hazırlarım\n` +
    `✅ Açık ödemeler ve kart bilgisi olmayan rezervasyonlar için uyarı veririm`;
  await sendText(ctx.phone, capabilities);

  await sleep(1800);

  // Mesaj 3 — Paneli Aç CTA (magic link mint inline)
  const { randomBytes } = await import("crypto");
  const { sendUrlButton } = await import("./send");
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://hotelai.upudev.nl";
  const panelToken = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId, token: panelToken, expires_at: expiresAt,
  });
  const panelUrl = `${APP_URL}/tr/otel-panel?t=${panelToken}`;
  const ctaMsg =
    `🖥 *Yönetim paneliniz hazır.*\n\n` +
    `Tüm sisteminizi yönetmek için panele gidin.\n\n` +
    `_Dilerseniz daha sonra komutlarla buradan da yönetebilirsiniz._`;
  await sendUrlButton(ctx.phone, ctaMsg, "🖥 Paneli Aç", panelUrl, { skipNav: true });

  // Profil metadata: onboarding tamamlandı + intro tetik tekrar etmesin
  const newMeta = {
    ...(profile?.metadata as Record<string, unknown> || {}),
    onboarding_completed: true,
    discovery_step: "completed",
  };
  await supabase.from("profiles").update({ metadata: newMeta }).eq("id", ctx.userId);

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
