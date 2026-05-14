/**
 * Organic signup — bayi tenant için davet kodu olmadan kayıt akışı.
 *
 * /tr/uye-ol mobile/QR akışından gelen "BAYI: Üye olmak istiyorum" gibi
 * pre-filled mesajları yakalar. Tenant resolve sırasında hiç profile'ı
 * olmayan (brand new phone) kullanıcılar için tetiklenir — yani
 * resolveTenantContext null döndükten sonra fallback.
 *
 * Mevcut auth.users (phone unique) constraint'i nedeniyle aynı phone'a
 * 2. profile yaratılamaz. Mevcut emlak kullanıcısı "BAYI:" prefix'i ile
 * gelse bile resolveTenantContext profile bulur (null değil); bu helper
 * sadece BRAND NEW phone'ları handle eder.
 *
 * Şu an sadece bayi tenant'ı için tam akış var (dealer-onboarding tetikler).
 * Diğer tenant'lar için hint yakalanırsa kibarca "davet kodu gerek" mesajı
 * dönülür — sonraki sprint'lerde her tenant kendi organic flow'unu ekler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { extractTenantHintFromText, stripTenantPrefix } from "@/platform/auth/tenant-identity";
import { sendText } from "./send";
import type { WaContext } from "./types";
import { getTenantByKey } from "@/tenants/config";

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
 * Organic signup akışını dene. Yakalandıysa true döner — caller başka
 * fallback yazmaz. Yakalanmadıysa false — caller mevcut "davet kodu"
 * mesajını gönderir.
 */
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

  if (hint !== "bayi") {
    // Diğer tenant'lar için organic signup henüz hazır değil — kibar bilgi.
    await sendText(
      phone,
      `Bu hizmet (${hint}) için kayıt şu an davet kodu ile yapılıyor.\n\n` +
        `Davet kodu için info@upudev.nl ile iletişime geçin.`,
    );
    return true;
  }

  return await startBayiOrganicSignup(supabase, phone, name);
}

async function startBayiOrganicSignup(
  supabase: SupabaseClient,
  phone: string,
  name: string,
): Promise<boolean> {
  const tenantCfg = getTenantByKey("bayi");
  if (!tenantCfg) {
    console.error("[organic-signup] bayi tenant config missing");
    return false;
  }
  const bayiTenantId = tenantCfg.tenantId;

  // Welcome — kayıt başlatıldığını bildir
  await sendText(
    phone,
    "🙋 *Hoş geldin!*\n\n" +
      "UPU Bayi yönetim sistemine seni kaydetmek için şirket bilgilerini soracağım — " +
      "7 kısa soru, ~3 dakika.\n\nBaşlayalım.",
  );

  // Auth user oluştur (placeholder email pattern, BAYI:CODE flow ile uyumlu)
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: `bayi_organic_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
    email_confirm: true,
    user_metadata: { name: name || phone },
  });

  if (authErr || !authUser?.user) {
    console.error("[organic-signup] auth.admin.createUser error:", authErr);
    await sendText(
      phone,
      "❌ Kayıt başlatılamadı.\n\n" +
        "Bu telefon başka bir hesapla zaten kayıtlı olabilir. " +
        "Lütfen info@upudev.nl ile iletişime geçin.",
    );
    return true; // handled (kullanıcıya cevap verdik)
  }

  const userId = authUser.user.id;

  // Owner rolü — full capability (OWNER_ALL "*")
  const { defaultCapabilitiesForRole } = await import("@/tenants/bayi/capabilities");
  const capabilities = defaultCapabilitiesForRole("admin");

  const { error: profileErr } = await supabase.from("profiles").insert({
    id: userId,
    tenant_id: bayiTenantId,
    display_name: name || phone,
    whatsapp_phone: phone,
    role: "admin",
    permissions: {},
    capabilities,
    preferred_locale: "tr",
  });

  if (profileErr) {
    console.error("[organic-signup] profile insert error:", profileErr);
    await sendText(phone, "❌ Profil oluşturulamadı. Lütfen tekrar deneyin veya info@upudev.nl ile iletişime geçin.");
    return true;
  }

  // Trial abonelik
  await supabase
    .from("subscriptions")
    .insert({
      tenant_id: bayiTenantId,
      user_id: userId,
      plan: "trial",
      status: "active",
    })
    .then((r) => {
      if (r.error) console.error("[organic-signup] subscription insert error:", r.error);
    });

  // saas_active_session — sonraki mesajlarda bayi context'inde kalsın
  await supabase
    .from("saas_active_session")
    .upsert({
      phone,
      active_saas_key: "bayi",
      updated_at: new Date().toISOString(),
    })
    .then((r) => {
      if (r.error) console.error("[organic-signup] active session upsert error:", r.error);
    });

  // Dealer onboarding'i başlat (firma adı → ... 7 adımlık akış)
  const onbCtx: WaContext = {
    phone,
    userId,
    tenantId: bayiTenantId,
    tenantKey: "bayi",
    userName: name || phone,
    locale: "tr",
    messageId: "",
    text: "",
    interactiveId: "",
    role: "admin",
    permissions: {},
    dealerId: null,
    capabilities,
  };

  const { startDealerOnboarding } = await import("@/tenants/bayi/commands/dealer-onboarding");
  await startDealerOnboarding(onbCtx);

  return true;
}
