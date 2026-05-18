/**
 * Organic signup — davet kodu olmadan multi-tenant kayıt akışı.
 *
 * İki giriş noktası:
 *   - tryOrganicSignup(...) — brand new phone (hiç profile yok)
 *     /api/whatsapp route.ts tCtx==null branch'tan çağrılır.
 *   - tryOrganicSignupForExistingUser(...) — mevcut user (emlak gibi)
 *     yeni tenant'a kayıt isterse — router.ts Faz 9.2 intent'ten çağrılır.
 *
 * Modern pattern (memory: "WA = uzaktan kumanda, PWA = kokpit"): WA'da
 * uzun chat onboarding YOK. Profile yaratılır → kısa welcome (3 mesaj)
 * → "Paneli Aç" buton → kullanıcı PWA'da hero/görevler kartından profile
 * tamamlama formuna gider.
 *
 * Schema invariant (Deep Foundation):
 *   - auth.users: 1 phone = 1 row (Supabase constraint, korunur)
 *   - profiles: (whatsapp_phone, tenant_id) UNIQUE + (auth_user_id, tenant_id) UNIQUE
 *   - Legacy profile: profile.id = auth.users.id, auth_user_id = id (backfill)
 *   - Multi-tenant profile: profile.id = fresh UUID, auth_user_id = auth.users.id
 */
import { randomBytes, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractTenantHintFromText, stripTenantPrefix } from "@/platform/auth/tenant-identity";
import { sendText, sendUrlButton } from "./send";
import type { WaContext } from "./types";
import { getTenantByKey } from "@/tenants/config";

/**
 * Bug 2 — Tenant-aware intro factory. Her tenant için 3 mesaj akışı:
 *   1) greet + core promise (kişisel asistan + ne yapacak özet)
 *   2) capabilities (4-5 ✅ madde)
 *   3) panelWelcome (Paneli Aç CTA ile gönderilir)
 *
 * Eski generic fallback "Hesabın hazır! 'panel' yazabilirsin" kaldırıldı
 * — her tenant artık kendi intro'sunu alır.
 */
interface TenantIntro {
  promise: string;
  capabilities: string;
  panelWelcome: string;
  /** Paneli Aç buton URL'inin /api/.../evergreen path segment'i. */
  evergreenPath: string;
}

function buildTenantIntro(tenantKey: string, firstName: string): TenantIntro {
  const greet = firstName ? `👋 Merhaba ${firstName}! ✨` : `👋 Merhaba! ✨`;
  switch (tenantKey) {
    case "bayi":
      return {
        promise:
          `${greet}\n\n` +
          `Ben kişisel asistanınız UPU. 7/24 tahsilatlarınızı ve sipariş operasyonunuzu kolaylaştıracağım.`,
        capabilities:
          `🎯 *Yapabileceklerimden bazıları:*\n\n` +
          `✅ Yeni bayi başvurularınızı telefonla onaylayıp sisteme eklerim\n` +
          `✅ Vadesi gelen tahsilatlarınız için hatırlatma metni hazırlar, onayınızla bayiye gönderirim\n` +
          `✅ Bayi siparişlerinizi WhatsApp'tan tek akışta sisteme kaydederim\n` +
          `✅ Tüm bayilerinize tek tıkla kampanya duyurusu yaparım`,
        panelWelcome:
          `🖥 *Bayi Panelinize Hoş Geldiniz*\n\n` +
          `Profilinizi tamamlamak ve sisteminizi yönetmek için panele gidin. ` +
          `Hero kartından "Profilini Tamamla" ile firma bilgilerinizi 5 dakikada doldurabilirsiniz.`,
        evergreenPath: "/api/bayi-panel/evergreen",
      };
    case "emlak":
      return {
        promise:
          `${greet}\n\n` +
          `Ben kişisel asistanınız UPU. 7/24 portföy ilanlarınızı ve müşteri taleplerinizi yönetmenizi kolaylaştıracağım.`,
        capabilities:
          `🎯 *Yapabileceklerimden bazıları:*\n\n` +
          `✅ Mülk ilanlarınızı tek mesajla portföyünüze eklerim\n` +
          `✅ Müşteri taleplerine eşleşen mülkleri otomatik öneririm\n` +
          `✅ Portföy değerlemesi ve fiyat analizi yaparım\n` +
          `✅ Tüm müşterilerinize tek tıkla yeni ilan / kampanya duyurusu`,
        panelWelcome:
          `🏠 *Emlak Panelinize Hoş Geldiniz*\n\n` +
          `Profilinizi tamamlamak ve portföyünüzü yönetmek için panele gidin. ` +
          `Hero kartından "Profilini Tamamla" ile ofis bilgilerinizi 5 dakikada doldurabilirsiniz.`,
        evergreenPath: "/api/emlak-panel/evergreen",
      };
    case "market":
      return {
        promise:
          `${greet}\n\n` +
          `Ben kişisel asistanınız UPU. Marketinizin stok, sipariş ve kasa operasyonunu WhatsApp'tan yöneteceğim.`,
        capabilities:
          `🎯 *Yapabileceklerimden bazıları:*\n\n` +
          `✅ Stok seviyesi düşen ürünlerinizi bildiririm\n` +
          `✅ Tedarikçi siparişlerinizi tek mesajla başlatırım\n` +
          `✅ Gün sonu kasa raporunu özetlerim\n` +
          `✅ Fiyat ve kampanya güncellemelerini panelden senkron ederim`,
        panelWelcome:
          `🛒 *Market Panelinize Hoş Geldiniz*\n\n` +
          `Profilinizi tamamlamak ve stok/sipariş akışınızı yönetmek için panele gidin.`,
        evergreenPath: "/api/market-panel/evergreen",
      };
    case "otel":
      return {
        promise:
          `${greet}\n\n` +
          `Ben kişisel asistanınız UPU. Otelinizin rezervasyon, check-in ve misafir deneyimi süreçlerini hızlandıracağım.`,
        capabilities:
          `🎯 *Yapabileceklerimden bazıları:*\n\n` +
          `✅ Yeni rezervasyonları otomatik kaydederim\n` +
          `✅ Check-in / check-out hatırlatmalarını gönderirim\n` +
          `✅ Oda doluluk ve müsaitlik raporlarını çıkarırım\n` +
          `✅ Misafir memnuniyet mesajlarını yönlendiririm`,
        panelWelcome:
          `🏨 *Otel Panelinize Hoş Geldiniz*\n\n` +
          `Profilinizi tamamlamak ve rezervasyon takvimini görmek için panele gidin.`,
        evergreenPath: "/api/otel-panel/evergreen",
      };
    case "restoran":
      return {
        promise:
          `${greet}\n\n` +
          `Ben kişisel asistanınız UPU. Restoranınızın masa, menü ve rezervasyon akışını WhatsApp'tan yöneteceğim.`,
        capabilities:
          `🎯 *Yapabileceklerimden bazıları:*\n\n` +
          `✅ Rezervasyonları otomatik alır, masa atarım\n` +
          `✅ Menü ve fiyat güncellemelerini paneldeki sürümle senkron tutarım\n` +
          `✅ Stok eksikliği uyarılarını mutfağa iletirim\n` +
          `✅ Müşteri yorumlarını derler, geri bildirim özetlerim`,
        panelWelcome:
          `🍽️ *Restoran Panelinize Hoş Geldiniz*\n\n` +
          `Profilinizi tamamlamak ve menünüzü düzenlemek için panele gidin.`,
        evergreenPath: "/api/restoran-panel/evergreen",
      };
    case "siteyonetim":
      return {
        promise:
          `${greet}\n\n` +
          `Ben kişisel asistanınız UPU. Site yönetiminizi (aidat, duyuru, teknik servis) WhatsApp'tan koordine edeceğim.`,
        capabilities:
          `🎯 *Yapabileceklerimden bazıları:*\n\n` +
          `✅ Aidat hatırlatmalarını sakinlere otomatik gönderirim\n` +
          `✅ Bakım ve arıza taleplerini teknik servise yönlendiririm\n` +
          `✅ Toplu duyuruları tek mesajla iletirim\n` +
          `✅ Gelir-gider raporlarını panele aktarırım`,
        panelWelcome:
          `🏢 *Site Yönetimi Panelinize Hoş Geldiniz*\n\n` +
          `Profilinizi tamamlamak ve site bilgilerinizi yönetmek için panele gidin.`,
        evergreenPath: "/api/site-panel/evergreen",
      };
    case "muhasebe":
      return {
        promise:
          `${greet}\n\n` +
          `Ben kişisel asistanınız UPU. Muhasebe büronuzun fatura, beyanname ve mükellef takibini hızlandıracağım.`,
        capabilities:
          `🎯 *Yapabileceklerimden bazıları:*\n\n` +
          `✅ Gelen faturaları e-Fatura entegrasyonundan çekerim\n` +
          `✅ Beyanname son tarihlerini hatırlatırım\n` +
          `✅ Mükellef cari hesap ve borç durumlarını raporlarım\n` +
          `✅ Tahsilat hatırlatmalarını otomatik gönderirim`,
        panelWelcome:
          `📊 *Muhasebe Panelinize Hoş Geldiniz*\n\n` +
          `Profilinizi tamamlamak ve mükellef listenizi görmek için panele gidin.`,
        evergreenPath: "/api/muhasebe-panel/evergreen",
      };
    default:
      // Bilinmeyen tenant — neutral fallback.
      return {
        promise: `${greet}\n\nBen kişisel asistanınız UPU. Operasyonunuzu WhatsApp'tan kolaylaştıracağım.`,
        capabilities: `🎯 *Yapabileceklerimden bazıları:*\n\n✅ Sorularınızı yanıtlar, görevlerinizi yönetirim`,
        panelWelcome: `🖥 *Panelinize Hoş Geldiniz*\n\nProfilinizi tamamlamak için panele gidin.`,
        evergreenPath: "/api/panel/evergreen",
      };
  }
}

/** "Üye olmak istiyorum" intent — prefix temizlendikten sonra eşleşir. */
function isUyeOlIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === "üye ol" ||
    lower === "uye ol" ||
    lower.startsWith("üye olmak") ||
    lower.startsWith("uye olmak")
  );
}


/**
 * Bug 3 — Tenant-aware base URL. Evergreen endpoint'leri root domain'de
 * (upudev.nl) mount değil; her tenant kendi subdomain'inde
 * (estateai/retailai/marketai/...). Tenant config'in `slug` field'ından
 * inşa edilir. Slug yoksa NEXT_PUBLIC_APP_URL fallback'a düşer (legacy).
 */
function getTenantBaseUrl(tenantKey: string): string {
  const cfg = getTenantByKey(tenantKey);
  if (cfg?.slug) return `https://${cfg.slug}.upudev.nl`;
  return process.env.NEXT_PUBLIC_APP_URL || "https://upudev.nl";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Brand new phone (no profile anywhere) ────────────────────────────

export async function tryOrganicSignup(
  supabase: SupabaseClient,
  phone: string,
  name: string,
  rawText: string,
): Promise<boolean> {
  const hint = extractTenantHintFromText(rawText);
  if (!hint) return false;

  const cleanText = stripTenantPrefix(rawText);
  if (!isUyeOlIntent(cleanText)) return false;

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: `${hint}_organic_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
    email_confirm: true,
    user_metadata: { name: name || phone },
  });
  if (authErr || !authUser?.user) {
    console.error("[organic-signup] auth.admin.createUser error:", authErr);
    await sendText(
      phone,
      "❌ Kayıt başlatılamadı. Bu telefon başka bir hesapla zaten kayıtlı olabilir. info@upudev.nl ile iletişime geçin.",
    );
    return true;
  }

  return await runTenantSignup(supabase, {
    authUserId: authUser.user.id,
    phone,
    name: name || phone,
    tenantKey: hint,
    isLegacyAuth: true,
  });
}

// ── Existing user (has profile in another tenant) ────────────────────

export async function tryOrganicSignupForExistingUser(
  supabase: SupabaseClient,
  ctx: WaContext,
  tenantKey: string,
): Promise<boolean> {
  return await runTenantSignup(supabase, {
    authUserId: ctx.authUserId,
    phone: ctx.phone,
    name: ctx.userName || ctx.phone,
    tenantKey,
    isLegacyAuth: false,
  });
}

// ── Shared signup runner ──────────────────────────────────────────────

interface SignupArgs {
  authUserId: string;
  phone: string;
  name: string;
  tenantKey: string;
  isLegacyAuth: boolean;
}

export async function runTenantSignup(
  supabase: SupabaseClient,
  args: SignupArgs,
): Promise<boolean> {
  const { authUserId, phone, name, tenantKey, isLegacyAuth } = args;

  const tenantCfg = getTenantByKey(tenantKey);
  if (!tenantCfg) {
    console.error("[organic-signup] tenant config missing:", tenantKey);
    return false;
  }

  // Capabilities — bayi için OWNER_ALL preset; diğerleri şimdilik boş
  let capabilities: string[] = [];
  if (tenantKey === "bayi") {
    const { defaultCapabilitiesForRole } = await import("@/tenants/bayi/capabilities");
    capabilities = defaultCapabilitiesForRole("admin");
  }

  const newProfileId = isLegacyAuth ? authUserId : randomUUID();

  // Option D — implicit KVKK consent: /tr/uye-ol disclaimer ("Kayıt olarak
  // KVKK Aydınlatma Metni ve Hizmet Şartları'nı kabul etmiş sayılırsınız.")
  // + WA üzerinden gönderilen "Üye olmak istiyorum" intent = consent gate.
  // Panel modal artık sadece legacy fallback (eski NULL kayıtlar için).
  const nowIso = new Date().toISOString();

  const { error: profileErr } = await supabase.from("profiles").insert({
    id: newProfileId,
    auth_user_id: authUserId,
    tenant_id: tenantCfg.tenantId,
    display_name: name,
    whatsapp_phone: phone,
    role: "admin",
    permissions: {},
    capabilities,
    preferred_locale: "tr",
    kvkk_consent_at: nowIso,
    kvkk_consent_version: "v1",
  });

  if (profileErr) {
    const code = (profileErr as { code?: string }).code;
    console.error("[organic-signup] profile insert error:", profileErr);
    if (code === "23505") {
      await sendText(phone, "Bu hizmete zaten kayıtlısın 👋\n\n'panel' yazarak panele dön.");
      return true;
    }
    await sendText(phone, "❌ Profil oluşturulamadı. Lütfen tekrar deneyin veya info@upudev.nl ile iletişime geçin.");
    return true;
  }

  // Trial abonelik
  await supabase
    .from("subscriptions")
    .insert({
      tenant_id: tenantCfg.tenantId,
      user_id: newProfileId,
      plan: "trial",
      status: "active",
    })
    .then((r) => {
      if (r.error) console.error("[organic-signup] subscription insert error:", r.error);
    });

  // saas_active_session — sonraki mesajlarda yeni tenant'ta kal
  await supabase
    .from("saas_active_session")
    .upsert({
      phone,
      active_saas_key: tenantKey,
      updated_at: new Date().toISOString(),
    })
    .then((r) => {
      if (r.error) console.error("[organic-signup] active session upsert error:", r.error);
    });

  // ── Part B: Multi-membership info — diğer tenant'lara üye mi? ──
  await maybeSendMultiMembershipInfo(supabase, phone, authUserId, tenantCfg.tenantId);

  // ── Part A: Welcome + Panel CTA (tenant-aware factory) ──
  await sendTenantPanelWelcome(phone, name, authUserId, tenantKey);
  return true;
}

// ── Part B helper ────────────────────────────────────────────────────

async function maybeSendMultiMembershipInfo(
  supabase: SupabaseClient,
  phone: string,
  authUserId: string,
  excludeTenantId: string,
): Promise<void> {
  type Row = { tenant_id: string; tenants: { saas_type: string; name: string } | null };
  const { data: others } = await supabase
    .from("profiles")
    .select("tenant_id, tenants(saas_type, name)")
    .eq("auth_user_id", authUserId)
    .neq("tenant_id", excludeTenantId)
    .returns<Row[]>();

  if (!others?.length) return;

  const lines = others
    .map((p) => {
      const t = p.tenants;
      if (!t) return null;
      const cfg = getTenantByKey(t.saas_type);
      const icon = cfg?.icon || "•";
      const brand = cfg?.name || t.name;
      return `${icon} ${brand}`;
    })
    .filter(Boolean);

  if (!lines.length) return;

  await sendText(
    phone,
    "ℹ️ *Bilgi*\n\n" +
      `Bu numara ile zaten şu UPU SaaS'lara üyesin:\n${lines.join("\n")}\n\n` +
      `Aralarında geçiş için WA'da "değiştir" yaz veya panel sidebar'daki ` +
      `"Üye olduğum SaaS'lar" bölümünden seç.`,
  );
}

// ── Part A: Tenant-aware welcome (inline 3 mesaj, modern pattern) ─────

async function sendTenantPanelWelcome(
  phone: string,
  name: string,
  authUserId: string,
  tenantKey: string,
): Promise<void> {
  const firstName = (name || "").split(/\s+/)[0] || "";
  const intro = buildTenantIntro(tenantKey, firstName);

  // Mesaj 1 — greet + core promise
  await sendText(phone, intro.promise);
  await sleep(1500);

  // Mesaj 2 — yetenekler
  await sendText(phone, intro.capabilities);
  await sleep(1500);

  // Mesaj 3 — Paneli Aç (evergreen URL — server-side fresh token mint).
  // Tenant subdomain'i kullan (Bug 3 fix); root domain'de evergreen mount
  // değil, retailai/estateai/marketai/... her tenant kendi subdomain'inde.
  const baseUrl = getTenantBaseUrl(tenantKey);
  const evergreenUrl = `${baseUrl}${intro.evergreenPath}?uid=${encodeURIComponent(authUserId)}`;
  await sendUrlButton(
    phone,
    intro.panelWelcome,
    "🖥 Paneli Aç",
    evergreenUrl,
    { skipNav: true },
  );
}
