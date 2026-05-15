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

/** Intro flow'u olmayan tenant'lar için "davet kodu gerek" placeholder. */
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://upudev.nl";

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

  // Capabilities — bayi için OWNER_ALL preset; diğerleri şimdilik boş
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

  // ── Part A: Welcome + Panel CTA (intro yerine inline modern pattern) ──
  if (tenantKey === "bayi") {
    await sendBayiPanelWelcome(phone, name, authUserId);
    return true;
  }

  // Diğer tenant'lar — şimdilik placeholder davet kodu mesajı
  const preIntro = PRE_INTRO_MESSAGES[tenantKey];
  if (preIntro) {
    await sendText(phone, preIntro);
    return true;
  }

  // Henüz organic signup tanımı olmayan tenant — generic fallback
  await sendText(phone, "🎉 Hesabın hazır! Panele ulaşmak için 'panel' yazabilirsin.");
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

// ── Part A: Bayi welcome (inline 3 mesaj, modern pattern) ────────────

async function sendBayiPanelWelcome(phone: string, name: string, authUserId: string): Promise<void> {
  const firstName = (name || "").split(/\s+/)[0] || "";
  const greet = firstName ? `👋 Merhaba ${firstName}! ✨` : `👋 Merhaba! ✨`;

  // Mesaj 1 — greet + core promise
  await sendText(
    phone,
    `${greet}\n\n` +
      `Ben kişisel asistanınız UPU. 7/24 tahsilatlarınızı ve sipariş operasyonunuzu kolaylaştıracağım.`,
  );
  await sleep(1500);

  // Mesaj 2 — yetenekler
  await sendText(
    phone,
    `🎯 *Yapabileceklerimden bazıları:*\n\n` +
      `✅ Yeni bayi başvurularınızı telefonla onaylayıp sisteme eklerim\n` +
      `✅ Vadesi gelen tahsilatlarınız için hatırlatma metni hazırlar, onayınızla bayiye gönderirim\n` +
      `✅ Bayi siparişlerinizi WhatsApp'tan tek akışta sisteme kaydederim\n` +
      `✅ Tüm bayilerinize tek tıkla kampanya duyurusu yaparım`,
  );
  await sleep(1500);

  // Mesaj 3 — Paneli Aç (evergreen URL — server-side fresh token mint)
  const evergreenUrl = `${APP_URL}/api/bayi-panel/evergreen?uid=${encodeURIComponent(authUserId)}`;
  await sendUrlButton(
    phone,
    `🖥 *Bayi Panelinize Hoş Geldiniz*\n\n` +
      `Profilinizi tamamlamak ve sisteminizi yönetmek için panele gidin. ` +
      `Hero kartından "Profilini Tamamla" ile firma bilgilerinizi 5 dakikada doldurabilirsiniz.`,
    "🖥 Paneli Aç",
    evergreenUrl,
    { skipNav: true },
  );
}
