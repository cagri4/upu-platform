/**
 * Bayi onboarding — discovery chain "Devam Et" callback handler.
 *
 * Adım: profil kaydedildi → step 1 prompt (demo açıklama + "Devam Et" buton)
 *   → kullanıcı "Devam Et" tıklar → bu fonksiyon çalışır:
 *     1) "yükleniyor" mesajı
 *     2) seedTenantDemoData (sektör profile.metadata.firma_profili.sektor'dan)
 *     3) advanceDiscovery("demo_seed_yuklendi") → step 2 prompt (kapanış)
 *
 * Idempotent davranış: tenant'ta zaten ürün varsa skip, yine de step 2'ye
 * geçer (kullanıcıyı tekrar tekrar tıklatmıyor).
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";
import { advanceDiscovery } from "@/platform/whatsapp/discovery-chain";
import { seedTenantDemoData } from "@/tenants/bayi/demo-import/seed";

export async function runBayiDemoSeedFromCallback(userId: string, phone: string): Promise<void> {
  const sb = getServiceClient();

  const { data: profile, error } = await sb
    .from("profiles")
    .select("id, tenant_id, metadata")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile?.tenant_id) {
    await sendText(phone, "❌ Profil okunamadı. Lütfen birazdan tekrar deneyin.");
    return;
  }

  const meta = (profile.metadata || {}) as Record<string, unknown>;
  const firmaProfili = (meta.firma_profili as { sektor?: string } | undefined);
  const sector = firmaProfili?.sektor || "boya";

  await sendText(phone,
    `📦 *Sektör örnek verisi yükleniyor...*\n\n` +
    `Birkaç saniye sürebilir, bekleyin lütfen.`,
  );

  const result = await seedTenantDemoData(sb, profile.tenant_id, profile.id, sector);

  if (!result.ok && !result.skipped) {
    await sendText(phone,
      `⚠️ Örnek veri yüklenirken hata oluştu: ${result.reason || "bilinmiyor"}\n\n` +
      `Lütfen birazdan tekrar deneyin.`,
    );
    return;
  }
  // result.ok || result.skipped — her iki durumda kullanıcıya tek "tamam"
  // mesajı veriyoruz; idempotent skip durumu kullanıcıya hatırlatma değil,
  // koridor akışında doğal devam.
  await sendText(phone, `✅ Veriler yüklendi. Şimdi devam edelim.`);

  // Step 2 prompt'u tetikle — kapanış mesajı + WA komut listesi.
  await advanceDiscovery(userId, "bayi", phone, "demo_seed_yuklendi");
}
