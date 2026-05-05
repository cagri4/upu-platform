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
      // Demo seed tamamlandı → Task 1 (bayi listesi web).
      // Tek mesaj: doğrudan magic-link CTA URL → ara reply button + 2'inci
      // mesaj (handleBayiDurum) eskisi anti-pattern.
      const greeting = ctx?.firstName ? `${ctx.firstName} Bey, ` : "";
      const token = await mintMagicToken(userId);
      const url = `${APP_URL_BY_TENANT.bayi}/tr/bayiler?t=${token}`;
      await sendUrlButton(phone,
        `🎉 *Sistem hazır!* (1/7)\n\n` +
        `${greeting}sektör örnek veriniz yüklendi. Birkaç dakikada sistemi tanıyalım.\n\n` +
        `*Adım 1 — Bayilerini gör*\n` +
        `Sisteme 5 örnek bayi yükledim. Aşağıdaki butona dokun → web panelde liste açılacak.`,
        "📋 Bayi Listesini Aç",
        url,
        { skipNav: true },
      );
      return true;
    }

    case 3: {
      // Task 2 — web liste'de kritik bayiye tıkla.
      // Plain text — kullanıcı zaten liste sayfasında, reply button gereksiz.
      // Vade kaydı varsa "X gün geçmiş", yoksa balance ile borçtan bahset.
      const critic = ctx?.kritikBayi || "Demir Ticaret";
      let detail: string;
      if (ctx?.kritikGun && ctx.kritikGun > 0) {
        detail = `vadesi *${ctx.kritikGun} gün geçmiş*`;
      } else if (ctx?.kritikBalance) {
        const fmt = new Intl.NumberFormat("tr-TR").format(ctx.kritikBalance);
        detail = `bakiyesi *${fmt} ₺* — borçlu`;
      } else {
        detail = `*kritik durumda*`;
      }
      await sendText(phone,
        `✅ *Bayi listen açıldı!* (2/7)\n\n` +
        `*Adım 2 — Kritik bayini tanı*\n\n` +
        `Listede *${critic}* öne çıkıyor — ${detail}. ` +
        `Üstüne dokunup detay sayfasına geç. Orada bakiyesini, son siparişlerini ve timeline'ı göreceksin.\n\n` +
        `_Detay sayfasında üst banner'da hatırlatma butonu hazır olacak._`,
      );
      return true;
    }

    case 4: {
      // Task 3 sonrası — Adım 4: ürün katalog (CTA URL).
      // bayilerim pattern'i — magic link mint + sendUrlButton.
      const token = await mintMagicToken(userId);
      const url = `${APP_URL_BY_TENANT.bayi}/tr/urunler?t=${token}`;
      await sendUrlButton(phone,
        `✅ *Hatırlatma yollandı!* (3/7)\n\n` +
        `*Adım 4 — Ürün kataloğun*\n` +
        `Sistemi keşfetmeye devam — sektörünüze yüklediğim 20 ürünü görelim. Aşağıdaki butona dokun → web panelde katalog açılacak.`,
        "📦 Katalogu Aç",
        url,
        { skipNav: true },
      );
      return true;
    }

    case 5: {
      // Adım 5 — ürün detayı. Plain text, kullanıcı zaten katalog sayfasında.
      const ornekUrun = ctx?.ornekUrun || "ilk ürün";
      await sendText(phone,
        `✅ *Katalogunu gördün!* (4/7)\n\n` +
        `*Adım 5 — Ürün detayı*\n\n` +
        `Listenin başındaki ürüne (örn. *${ornekUrun}*) dokun → fiyat, stok, açıklama, son siparişler tek sayfada.\n\n` +
        `_Detay açıldıktan sonra otomatik bir sonraki adıma geçeceğim._`,
      );
      return true;
    }

    case 6: {
      // Task 5 — sipariş (CTA URL, bayilerim/urunler pattern).
      const critic = ctx?.kritikBayi || "Demir Ticaret";
      const token = await mintMagicToken(userId);
      const url = `${APP_URL_BY_TENANT.bayi}/tr/bayi-siparis?t=${token}`;
      await sendUrlButton(phone,
        `✅ *Ürün detayını gördün!* (5/7)\n\n` +
        `*Adım 5 — İlk siparişin*\n` +
        `Pratik yapalım — *${critic}* için 2 ürünlük örnek bir sipariş oluşturalım. ` +
        `Aşağıdaki butona dokun → web panelde sipariş formu açılacak.`,
        "📝 Sipariş Formunu Aç",
        url,
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
  kritikBalance?: number;       // Vade kaydı yoksa borçtan bahset
  ornekUrun?: string;
}

/**
 * Tour mesajları için somut isimleri ÖNCELİKLE gerçek tenant DB'sinden,
 * sonra sektör seed dataset'inden çeker. Tutarsızlığı önler — kullanıcı
 * eski/farklı veri yüklü tenant'ta tour'a girerse tour mesajı tabloda
 * olmayan bayiden değil, GERÇEK kritik bayiden bahsetmeli.
 *
 * Fallback hiyerarşisi (kritik bayi):
 *   1. bayi_dealer_invoices'ta is_paid=false + due_date geçmiş en eski vade
 *   2. bayi_dealers.balance > 0 en yüksek borçlu (vade kaydı yoksa)
 *   3. Sektör seed dataset'inden marker (boş tenant senaryosu)
 *   4. Hard-coded "Demir Ticaret" (en son fallback)
 */
async function loadBayiTourContext(userId: string): Promise<BayiTourContext> {
  try {
    const sb = getServiceClient();
    const { data: profile } = await sb
      .from("profiles")
      .select("display_name, tenant_id, metadata")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.tenant_id) return {};

    const meta = (profile.metadata || {}) as Record<string, unknown>;
    const firmaProfili = (meta.firma_profili as { sektor?: string; yetkili_adi?: string } | undefined);
    const sektor = firmaProfili?.sektor || "boya";
    const fullName = firmaProfili?.yetkili_adi || profile.display_name || "";
    const firstName = fullName ? fullName.split(/\s+/)[0] : undefined;

    let kritikBayi: string | undefined;
    let kritikGun: number | undefined;
    let ornekUrun: string | undefined;

    // 1. Gerçek tenant'tan kritik bayi — en eski vadesi geçmiş invoice
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data: overdueInvoice } = await sb
      .from("bayi_dealer_invoices")
      .select("dealer_id, due_date")
      .eq("tenant_id", profile.tenant_id)
      .eq("is_paid", false)
      .lt("due_date", todayIso)
      .order("due_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (overdueInvoice?.dealer_id) {
      const { data: dealer } = await sb
        .from("bayi_dealers")
        .select("name, company_name")
        .eq("id", overdueInvoice.dealer_id)
        .maybeSingle();
      if (dealer) {
        kritikBayi = (dealer.name as string) || (dealer.company_name as string);
        const due = new Date(overdueInvoice.due_date as string);
        const diffDays = Math.floor((Date.now() - due.getTime()) / 86400000);
        if (diffDays > 0) kritikGun = diffDays;
      }
    }

    // 2. Vade kaydı yok ama balance > 0 — en yüksek borçlu fallback
    let kritikBalance: number | undefined;
    if (!kritikBayi) {
      const { data: topDebtor } = await sb
        .from("bayi_dealers")
        .select("name, company_name, balance")
        .eq("tenant_id", profile.tenant_id)
        .gt("balance", 0)
        .order("balance", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (topDebtor) {
        kritikBayi = (topDebtor.name as string) || (topDebtor.company_name as string);
        kritikBalance = Number(topDebtor.balance) || undefined;
      }
    }

    // 3. Tenant'ta hiç bayi yoksa — sektör seed dataset marker (boş demo)
    if (!kritikBayi) {
      const { getSectorDataset } = await import("@/tenants/bayi/demo-import/sectors");
      const ds = getSectorDataset(sektor);
      let kritikIdx = 0;
      let mostOverdue = 0;
      ds.invoices.forEach(inv => {
        if (!inv.is_paid && inv.due_days_offset < mostOverdue) {
          mostOverdue = inv.due_days_offset;
          kritikIdx = inv.dealer_index;
        }
      });
      kritikBayi = ds.dealers[kritikIdx]?.name;
      if (!kritikGun && mostOverdue) kritikGun = Math.abs(mostOverdue);
    }

    // Örnek ürün: tenant'ta varsa ilk ürün, yoksa seed dataset'ten ilk
    const { data: firstProduct } = await sb
      .from("bayi_products")
      .select("name")
      .eq("tenant_id", profile.tenant_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstProduct?.name) {
      ornekUrun = firstProduct.name as string;
    } else {
      const { getSectorDataset } = await import("@/tenants/bayi/demo-import/sectors");
      ornekUrun = getSectorDataset(sektor).products[0]?.name;
    }

    return { firstName, kritikBayi, kritikGun, kritikBalance, ornekUrun };
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
