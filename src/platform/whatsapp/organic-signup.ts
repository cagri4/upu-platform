/**
 * Organic signup — davet kodu olmadan multi-tenant kayıt akışı.
 *
 * İki giriş noktası:
 *   - tryOrganicSignup(...) — brand new phone (hiç profile yok)
 *     /api/whatsapp route.ts tCtx==null branch'tan çağrılır.
 *   - tryOrganicSignupForExistingUser(...) — mevcut user (emlak gibi)
 *     yeni tenant'a kayıt isterse — router.ts Faz 9.2 intent'ten çağrılır.
 *
 * Schema invariant (Deep Foundation):
 *   - auth.users: 1 phone = 1 row (Supabase constraint, korunur)
 *   - profiles: (whatsapp_phone, tenant_id) UNIQUE + (auth_user_id, tenant_id) UNIQUE
 *     → bir auth.user N profile (her tenant'ta ayrı) sahibi olabilir
 *   - Legacy profile satırı: profile.id = auth.users.id (backfill: auth_user_id = id)
 *   - Yeni multi-tenant profile: profile.id = fresh UUID, auth_user_id = auth.users.id
 *
 * Şu an sadece bayi tenant'ı için tam onboarding akışı var (dealer-onboarding).
 * Diğer tenant'lar için welcome mesajı + "site/profil sayfasından devam et"
 * — organic flow her tenant için ayrı sprint.
 */
import { randomBytes, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractTenantHintFromText, stripTenantPrefix } from "@/platform/auth/tenant-identity";
import { sendText } from "./send";
import type { WaContext } from "./types";
import { getTenantByKey } from "@/tenants/config";

/**
 * Tenant'lara özel pre-intro greeting. Modern pattern: bayi/intro-supported
 * tenant'lar için boş — intro.ts kendi 3 mesajlı welcome'ını gönderir
 * (çift greeting'i önler). Sadece intro flow'u olmayan tenant'lar için
 * davet kodu placeholder mesajı.
 */
const PRE_INTRO_MESSAGES: Record<string, string> = {
  market:
    "🛒 *Hoş geldin!*\n\n" +
    "UPU Market kayıt akışı henüz davet kodu ile yapılıyor. info@upudev.nl ile iletişime geçin.",
  muhasebe:
    "📊 *Hoş geldin!*\n\n" +
    "UPU Muhasebe kayıt akışı henüz davet kodu ile yapılıyor. info@upudev.nl ile iletişime geçin.",
};

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

  // Brand new phone — auth user yarat
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
    isLegacyAuth: true, // brand new — profile.id = auth.users.id pattern
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
    isLegacyAuth: false, // mevcut user — profile.id = fresh UUID, auth_user_id ayrı
  });
}

// ── Shared signup runner ──────────────────────────────────────────────

interface SignupArgs {
  authUserId: string;
  phone: string;
  name: string;
  tenantKey: string;
  /**
   * true: profile.id = authUserId (legacy 1-1, brand new user)
   * false: profile.id = fresh UUID (multi-tenant, existing user)
   */
  isLegacyAuth: boolean;
}

async function runTenantSignup(
  supabase: SupabaseClient,
  args: SignupArgs,
): Promise<boolean> {
  const { authUserId, phone, name, tenantKey, isLegacyAuth } = args;

  const tenantCfg = getTenantByKey(tenantKey);
  if (!tenantCfg) {
    console.error("[organic-signup] tenant config missing:", tenantKey);
    return false;
  }

  // Pre-intro greeting — intro flow'u olmayan tenant'lar için fallback.
  // Bayi/emlak/restoran/siteyonetim/otel/market intro.ts'te kendi 3 mesajlı
  // welcome'ını gönderir (modern pattern); buraya placeholder düşmesin.
  const preIntro = PRE_INTRO_MESSAGES[tenantKey];
  if (preIntro) await sendText(phone, preIntro);

  // Capabilities — şimdilik sadece bayi'de OWNER_ALL preset var; diğerleri []
  let capabilities: string[] = [];
  if (tenantKey === "bayi") {
    const { defaultCapabilitiesForRole } = await import("@/tenants/bayi/capabilities");
    capabilities = defaultCapabilitiesForRole("admin");
  }

  const newProfileId = isLegacyAuth ? authUserId : randomUUID();

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
  });

  if (profileErr) {
    const code = (profileErr as { code?: string }).code;
    console.error("[organic-signup] profile insert error:", profileErr);
    if (code === "23505") {
      // Aynı auth_user + tenant zaten kayıtlı — paralel istekte yarış olabilir
      await sendText(phone, "Bu hizmete zaten kayıtlısın 👋\n\n'panel' yazarak panele dön.");
      return true;
    }
    await sendText(phone, "❌ Profil oluşturulamadı. Lütfen tekrar deneyin veya info@upudev.nl ile iletişime geçin.");
    return true;
  }

  // Trial abonelik (her tenant'a — billing tarafı ayrıştırma sonra)
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

  // Modern pattern: intro.ts kendi 3 mesajlı greet + capabilities + PWA form
  // CTA gönderir. WA'da 7-soru chat akışı YOK — form web panelinde doldurulur
  // (memory: "3-kanalli mimari: WA=uzaktan kumanda, Web panel=kokpit. Form
  // agir isleri web'e tasi.").
  const onbCtx: WaContext = {
    phone,
    userId: newProfileId,
    authUserId,
    tenantId: tenantCfg.tenantId,
    tenantKey,
    userName: name,
    locale: "tr",
    messageId: "",
    text: "",
    interactiveId: "",
    role: "admin",
    permissions: {},
    dealerId: null,
    capabilities,
  };

  const { startIntro } = await import("./intro");
  const introOk = await startIntro(onbCtx);

  if (!introOk) {
    // Intro flow desteklenmeyen tenant veya runtime hata — fallback: kısa
    // bilgi + evergreen panel URL (token'sız, fresh mint).
    await sendText(phone, "🎉 Hesabın hazır! Aşağıdaki panelden devam et.");
    const subdomain = tenantCfg.slug || tenantKey;
    const evergreenUrl =
      tenantKey === "bayi"
        ? `https://${subdomain}.upudev.nl/api/bayi-panel/evergreen?uid=${encodeURIComponent(authUserId)}`
        : `https://${subdomain}.upudev.nl/api/panel/evergreen?uid=${encodeURIComponent(authUserId)}`;
    const { sendUrlButton } = await import("./send");
    await sendUrlButton(
      phone,
      "🖥 *Profilini Tamamla*\n\n" +
        "Firma bilgilerini panel üzerinden doldur (~2 dk). " +
        "Sonrasında kullanmaya başlayabilirsin.",
      "🖥 Panele Git",
      evergreenUrl,
      { skipNav: true },
    );
  }

  return true;
}
