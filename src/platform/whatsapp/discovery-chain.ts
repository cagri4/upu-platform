/**
 * Discovery Chain — guided first-use flow through killer features.
 *
 * After onboarding, each completed feature naturally suggests the next,
 * creating a chain of real product usage. The state machine is per-tenant
 * because each SaaS has a different killer feature sequence:
 *
 *   emlak: mulk_eklendi → sunum_hazir → tarama_kuruldu → portfoy_tanitildi
 *   bayi:  firma_kaydedildi → demo_seed_yuklendi
 *
 * Bayi 2026-05-04 sonrası demo akış: profil kaydedildikten sonra sektör
 * bazlı örnek veri yüklenir ("Devam Et" butonu), ardından kapanış mesajı.
 * Eski 4-adım manuel akış (urun_eklendi → bayi_davet → kampanya) demo
 * mode'da yerini tek-tıkla seed'e bıraktı; manuel ürün ekleme artık
 * "Ürünler" sayfasındaki "Yeni Ürün" butonuyla erişilir.
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
    demo_seed_yuklendi: 2,
    tour_bayilerim_done: 3,
    tour_kritik_bayi_done: 4,
    tour_urunler_done: 5,
    tour_urun_detay_done: 6,
    tour_siparis_done: 7,
    tour_sabah_done: 8,
    tour_tahsilat_done: 9,
  },
  siteyonetim: {
    setup_complete: 1,         // onboarding 4-soru tamamlandı + demo seed yüklendi
    tour_rapor_done: 2,
    tour_aidat_done: 3,
    tour_borc_done: 4,
    tour_bakim_done: 5,
    tour_ariza_done: 6,
    tour_gelirgider_done: 7,
    tour_binakodu_done: 8,
  },
};

const MAX_STEP_BY_TENANT: Record<string, number> = {
  emlak: 4,
  bayi: 9,
  siteyonetim: 8,
};

const APP_URL_BY_TENANT: Record<string, string> = {
  emlak: "https://estateai.upudev.nl",
  bayi: "https://retailai.upudev.nl",
  siteyonetim: "https://residenceai.upudev.nl",
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

export async function setDiscoveryStep(userId: string, tenantKey: string, step: number): Promise<void> {
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
  if (tenantKey === "siteyonetim") return sendSiteyonetimStepPrompt(userId, phone, targetStep);
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
        { skipNav: true },
      );
      return true;
    case 2:
      await sendButtons(phone,
        `✨ *Sunumun hazır!*\n\n` +
        `Magic linki müşterine gönderebilirsin.\n\n` +
        `Şimdi piyasa taraması kuralım — senin vereceğin kriterlere göre her sabah bölgendeki yeni ilanları sana raporlayacağım. Bir fırsat kaçırma!`,
        [{ id: "cmd:takipEt", title: "📡 Tarama Kur" }],
        { skipNav: true },
      );
      return true;
    case 3:
      await sendButtons(phone,
        `📡 *Taraman hazır!*\n\n` +
        `Her sabah bölgendeki yeni ilanları raporlayacağım.\n\n` +
        `*Ve dahası:* sabah raporunda *sahibinden olan ilanların sahiplerini* de göstereceğim. Bir ilana ilgilendiğini söylersen, sahibini bulup sana hazır bir AI mesaj taslağıyla tek tık iletişim fırsatı sunacağım.\n\n` +
        `Portföyünü büyütmek artık günde 5 dakikalık bir iş.`,
        [{ id: "disc:portfoy_ok", title: "🚀 Anladım" }],
        { skipNav: true },
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
  // Tour step prompt'ları (step 2..9) için sektörel kritik bayi/ürün
  // adlarını profile.metadata'dan çekiyoruz; mesajlar sektöre göre
  // somut hissetsin diye.
  const ctx = step >= 2 ? await loadBayiTourContext(userId) : null;

  switch (step) {
    case 1: {
      // Firma profili tamamlandı → demo modu açıklaması + "Devam Et" callback.
      // skipNav: koridor içi — Navigasyon kalabalığı yapma.
      await sendButtons(phone,
        `✅ *Firma profiliniz hazır!*\n\n` +
        `🔧 *Demo modu*\n` +
        `Ürün ve bayi sisteminizden veri çekme işlemi entegrasyon ekibimiz tarafından kurulum sürecinde yapılacaktır. ` +
        `Şimdilik *sektörünüze uygun örnek veriyle* başlıyorum:\n\n` +
        `   • 5 örnek bayi (1 kritik vade)\n` +
        `   • 5 kategori\n` +
        `   • 20 ürün\n` +
        `   • Birkaç sipariş + vade hareketi\n\n` +
        `Sistemi anında deneyebilirsiniz.`,
        [{ id: "disc:demo_seed_yukle", title: "▶️ Devam Et" }],
        { skipNav: true },
      );
      return true;
    }

    case 2: {
      // Demo seed tamamlandı → AI-led tour intro + Task 1 (bayilerim).
      const greeting = ctx?.firstName ? `${ctx.firstName} Bey, ` : "";
      await sendButtons(phone,
        `🎉 *Sistem hazır!* (1/7)\n\n` +
        `${greeting}sektör örnek veriniz yüklendi. Birkaç dakikada sistemi tanıyalım.\n\n` +
        `*Adım 1 — Bayilerini gör*\n` +
        `Sisteme 5 örnek bayi yükledim. Listeyi görmek için aşağıdaki komutu yaz:\n\n` +
        `   👉 *bayilerim*`,
        [
          { id: "cmd:bayidurum", title: "📋 bayilerim" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }

    case 3: {
      // Task 2 — kritik bayiyi tanı.
      const critic = ctx?.kritikBayi || "Demir Ticaret";
      const days = ctx?.kritikGun || 12;
      await sendButtons(phone,
        `✅ *Bayi listeni gördün!* (2/7)\n\n` +
        `*Adım 2 — Kritik bayini tanı*\n\n` +
        `Listedeki *${critic}* (kırmızı uyarılı) kritik durumda — vadesi *${days} gün geçmiş*. ` +
        `Detayını görmek için:\n\n` +
        `   👉 *${critic.toLowerCase().split(" ")[0]}* yaz veya *bayidurum* komutunu kullan`,
        [
          { id: "cmd:bayidurum", title: "🏪 Bayi Detay" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }

    case 4: {
      // Task 3 — ürün katalog.
      await sendButtons(phone,
        `✅ *Bayi detaylarını gördün!* (3/7)\n\n` +
        `*Adım 3 — Ürün kataloğun*\n` +
        `Şimdi ürün kataloğunu inceleyelim. Aşağıdaki komutu yaz:\n\n` +
        `   👉 *urunler*`,
        [
          { id: "cmd:urunler", title: "📦 urunler" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }

    case 5: {
      // Task 4 — ürün detayı.
      const ornekUrun = ctx?.ornekUrun || "ilk ürün";
      await sendButtons(phone,
        `✅ *Kataloğunu gördün!* (4/7)\n\n` +
        `*Adım 4 — Ürün detayı*\n` +
        `Listenin başındaki ürüne (örn. *${ornekUrun}*) bakalım. *fiyatliste* komutu fiyat ve stok özetini gösterir:\n\n` +
        `   👉 *fiyatliste*`,
        [
          { id: "cmd:fiyatliste", title: "💰 fiyatliste" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }

    case 6: {
      // Task 5 — mock sipariş.
      const critic = ctx?.kritikBayi || "Demir Ticaret";
      await sendButtons(phone,
        `✅ *Ürün detayını gördün!* (5/7)\n\n` +
        `*Adım 5 — İlk siparişin*\n` +
        `Pratik yapalım. *${critic}* için 2 ürünlük örnek bir sipariş oluşturalım:\n\n` +
        `   👉 *siparis* yaz, akışı tamamla.`,
        [
          { id: "cmd:siparisolustur", title: "🛒 siparis" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }

    case 7: {
      // Task 6 — sabah brifingi.
      await sendButtons(phone,
        `✅ *Siparişin oluştu!* (6/7)\n\n` +
        `*Adım 6 — Sabah brifingin*\n` +
        `Her sabah AI seni bilgilendirir: kritik vadeler, bekleyen siparişler, kritik stok. ` +
        `Bugünün örnek brifingini görmek için:\n\n` +
        `   👉 *sabah* yaz (özet de çalışır)`,
        [
          { id: "cmd:ozet", title: "🌅 sabah" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }

    case 8: {
      // Task 7 — tahsilat hatırlatma.
      const critic = ctx?.kritikBayi || "Demir Ticaret";
      await sendButtons(phone,
        `✅ *Brifingini aldın!* (7/7)\n\n` +
        `*Son adım — Tahsilat hatırlatma*\n` +
        `*${critic}*'ye otomatik vade hatırlatma gönderebilirsin. Hatırlatma mesajını AI yazar:\n\n` +
        `   👉 *tahsilat* yaz`,
        [
          { id: "cmd:tahsilat", title: "💵 tahsilat" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }

    case 9: {
      // Tour completed → free-ride.
      await sendButtons(phone,
        `🎓 *Tebrikler! Sistemi tanıdın.*\n\n` +
        `Artık serbest mod: Tüm komutları kullanabilir, ekibini davet edebilir, gerçek veri için entegrasyon talep edebilirsin.\n\n` +
        `*Hızlı erişim:*\n` +
        `• *menu* — tüm komutlar\n` +
        `• *yardim* — komut açıklaması\n` +
        `• *webpanel* — web yönetim`,
        [
          { id: "cmd:webpanel", title: "🖥 Web Panel" },
          { id: "cmd:calisanekle", title: "👥 Çalışan Davet" },
          { id: "cmd:menu", title: "📋 Ana Menü" },
        ],
        { skipNav: true },
      );
      return true;
    }
  }
  return false;
}

interface BayiTourContext {
  firstName?: string;
  kritikBayi?: string;
  kritikGun?: number;
  ornekUrun?: string;
}

/**
 * Sektör + bayi/ürün isimlerini profile.metadata + sectors registry'den
 * çekerek tour mesajlarına dinamik somutluk katar. Hata durumunda boş
 * dönüp default fallback'lere izin verir.
 */
async function loadBayiTourContext(userId: string): Promise<BayiTourContext> {
  try {
    const sb = getServiceClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, metadata")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return {};
    const meta = (profile.metadata || {}) as Record<string, unknown>;
    const firmaProfili = (meta.firma_profili as { sektor?: string; yetkili_adi?: string } | undefined);
    const sektor = firmaProfili?.sektor || "boya";
    const fullName = firmaProfili?.yetkili_adi || profile.display_name || "";
    const firstName = fullName ? fullName.split(/\s+/)[0] : undefined;

    // Sektör dataset'ten kritik bayi + örnek ürün al
    const { getSectorDataset } = await import("@/tenants/bayi/demo-import/sectors");
    const ds = getSectorDataset(sektor);
    // Kritik bayi: en yüksek vadeli — invoices içinde en negatif due_days_offset
    let kritikIdx = 0;
    let mostOverdue = 0;
    ds.invoices.forEach(inv => {
      if (!inv.is_paid && inv.due_days_offset < mostOverdue) {
        mostOverdue = inv.due_days_offset;
        kritikIdx = inv.dealer_index;
      }
    });
    const kritikBayi = ds.dealers[kritikIdx]?.name;
    const kritikGun = mostOverdue ? Math.abs(mostOverdue) : undefined;
    const ornekUrun = ds.products[0]?.name;

    return { firstName, kritikBayi, kritikGun, ornekUrun };
  } catch (err) {
    console.error("[discovery-chain] tour ctx error:", err);
    return {};
  }
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

// ── Siteyönetim prompts ──────────────────────────────────────────────
//
// 7-task tour. step 1 onboarding + demo seed sonrası başlar (Task 1: rapor),
// step 7 son task (binakodu — sakin daveti), step 8 free-ride kapanışı.

async function loadSiteyonetimTourContext(userId: string): Promise<{ buildingName?: string; firstName?: string }> {
  try {
    const sb = getServiceClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, metadata")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return {};
    const meta = (profile.metadata || {}) as Record<string, unknown>;
    const buildingName = (meta.building_name as string) || undefined;
    const fullName = profile.display_name || "";
    const firstName = fullName ? fullName.split(/\s+/)[0] : undefined;
    return { buildingName, firstName };
  } catch {
    return {};
  }
}

async function sendSiteyonetimStepPrompt(userId: string, phone: string, step: number): Promise<boolean> {
  const ctx = await loadSiteyonetimTourContext(userId);
  const greeting = ctx.firstName ? `${ctx.firstName} Bey, ` : "";
  const bina = ctx.buildingName || "Binanız";

  switch (step) {
    case 1: {
      // Onboarding + demo seed tamamlandı → Task 1: rapor (sabah brifingi).
      await sendButtons(phone,
        `🎉 *Sistem hazır!* (1/7)\n\n` +
        `${greeting}${bina} için 18 sakin, 3 ay aidat, 3 açık arıza yükledim. Birkaç dakikada sistemi tanıyalım.\n\n` +
        `*Adım 1 — Sabah brifingin*\n` +
        `Her sabah günlük durumu özetliyorum: kaç borçlu daire, kaç açık arıza, kasada ne var. Bugünün özetini görmek için:\n\n` +
        `   👉 *rapor*`,
        [
          { id: "cmd:rapor", title: "📊 rapor" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }
    case 2: {
      // Task 2 — aidat: kim borçlu?
      await sendButtons(phone,
        `✅ *Brifingi gördün!* (2/7)\n\n` +
        `*Adım 2 — Kim borçlu?*\n` +
        `Hangi daireler aidat ödememiş, hangi dönem? Vade geçmiş borçları toplu görelim:\n\n` +
        `   👉 *aidat*`,
        [
          { id: "cmd:aidat", title: "💰 aidat" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }
    case 3: {
      // Task 3 — borc: daire bazlı detay (kritik durumu fark).
      await sendButtons(phone,
        `✅ *Borçlu listesini gördün!* (3/7)\n\n` +
        `*Adım 3 — Daire bazlı borç*\n` +
        `Daire 1A iki ay üst üste ödemedi — gecikme faiziyle birlikte detayı görelim:\n\n` +
        `   👉 *borc*`,
        [
          { id: "cmd:borcum", title: "🏠 borc" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }
    case 4: {
      // Task 4 — bakim: açık arızalar.
      await sendButtons(phone,
        `✅ *Borç detayını gördün!* (4/7)\n\n` +
        `*Adım 4 — Açık arızalar*\n` +
        `Sakinlerin bildirdiği arızalar tek listede: asansör, su sızıntısı, elektrik. Hepsi bekliyor:\n\n` +
        `   👉 *bakim*`,
        [
          { id: "cmd:bakim", title: "🔧 bakim" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }
    case 5: {
      // Task 5 — ariza: pratik yeni arıza yarat.
      await sendButtons(phone,
        `✅ *Açık arızaları gördün!* (5/7)\n\n` +
        `*Adım 5 — Yeni arıza ekle*\n` +
        `Pratik yapalım. Yeni bir arıza bildirimi yaratalım — 3 adımda kategori → öncelik → açıklama:\n\n` +
        `   👉 *ariza*`,
        [
          { id: "cmd:ariza", title: "🆕 ariza" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }
    case 6: {
      // Task 6 — gelir_gider: kasa.
      await sendButtons(phone,
        `✅ *Arıza bildirimini denedin!* (6/7)\n\n` +
        `*Adım 6 — Kasa durumu*\n` +
        `Aidat tahsilat + giderler (temizlik, elektrik, asansör bakımı). Tüm hareketleri ve net bakiyeyi görmek için:\n\n` +
        `   👉 *gelir_gider*`,
        [
          { id: "cmd:gelir_gider", title: "💵 gelir_gider" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }
    case 7: {
      // Task 7 — binakodu: sakin daveti.
      await sendButtons(phone,
        `✅ *Kasayı gördün!* (7/7)\n\n` +
        `*Son adım — Sakinleri sisteme bağla*\n` +
        `Sakinler kendi telefonlarından "kayit ABC123" yazarak bağlanır. ${bina} için bina kodunu görmek için:\n\n` +
        `   👉 *binakodu*`,
        [
          { id: "cmd:binakodu", title: "🔑 binakodu" },
          { id: "disc:tour_atla", title: "⏭ Tour'u Atla" },
        ],
        { skipNav: true },
      );
      return true;
    }
    case 8: {
      // Tour completed → free-ride.
      await sendButtons(phone,
        `🎓 *Tebrikler! Sistemi tanıdın.*\n\n` +
        `Artık serbest mod. ${bina} için günlük yönetim akışı:\n` +
        `• *rapor* — sabah brifingi\n` +
        `• *aidat* / *borc* — tahsilat takibi\n` +
        `• *bakim* / *ariza* — arıza yönetimi\n` +
        `• *gelir_gider* — kasa hareketleri\n` +
        `• *duyuru* — sakinlere toplu mesaj\n` +
        `• *binakodu* — sakin davet kodu\n\n` +
        `Tüm komutlar için *menu* yazın.`,
        [
          { id: "cmd:menu", title: "📋 Ana Menü" },
          { id: "cmd:binakodu", title: "🔑 Bina Kodu" },
        ],
        { skipNav: true },
      );
      return true;
    }
  }
  return false;
}
