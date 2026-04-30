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
import { sendButtons, sendText } from "./send";
import {
  getOnboardingFlow,
  getOnboardingState,
  initOnboarding,
  sendOnboardingStep,
} from "./onboarding";
import { getServiceClient } from "@/platform/auth/supabase";

const INTRO_TENANTS = new Set(["emlak", "bayi"]);

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

  const supabase = getServiceClient();

  // Welcome + yetenek listesi
  const introMsg =
    `👋 Merhaba! Ben UPU, sizin kişisel AI asistanınızım. 7/24 satışlarınızı artırmak için çalışacağım.\n\n` +
    `*Yapabileceklerimden bazıları:*\n\n` +
    `• Her sabah sahibinden'de bölgenize düşen *yeni sahibi ilanları* kriterinize göre süzüp link listesi olarak WhatsApp'a gönderirim. Tek tıkla linkleri inceler, dilerseniz hızlı bir şekilde sahibinden verilmiş ilan sahibine ulaşırsınız.\n` +
    `• Portföyünüz için dakikalar içinde profesyonel sunumlar hazırlar, tek linkle müşterinize gönderirim.\n` +
    `• Sunum ve ilan açıklamalarında yapay zeka ile satış hedefli metinler yazarım.\n` +
    `• Sahibinden.com'a ilan yüklemenizi 30 dakikadan 3 dakikaya indiririm.`;

  await sendText(ctx.phone, introMsg);

  // Mark onboarding completed
  const { data: profile } = await supabase
    .from("profiles")
    .select("metadata")
    .eq("id", ctx.userId)
    .single();
  const newMeta = {
    ...(profile?.metadata as Record<string, unknown> || {}),
    onboarding_completed: true,
    discovery_step: 0,
  };
  await supabase.from("profiles").update({ metadata: newMeta }).eq("id", ctx.userId);

  // Flow 1: DEMO ARAMA — "Bak sana uyan yeni ilanları birlikte görelim"
  // /tr/ara form açılır, kullanıcı kriter seçer → sonuçlar alta döker.
  // Demo araması tamamlanınca /api/ara/save takip kurma mesajını tetikler.
  const { randomBytes } = await import("crypto");
  const araToken = randomBytes(16).toString("hex");
  // Discovery chain — kullanıcı sabah 06:03 mesajını alıyor; 2sa TTL gün içinde
  // dolup "Linkin süresi dolmuş" hatasıyla kapatıyordu. 7 güne uzatıldı.
  const araExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token: araToken,
    expires_at: araExpires,
  });
  const araUrl = `https://estateai.upudev.nl/tr/ara?t=${araToken}`;

  const { sendUrlButton } = await import("./send");
  await sendUrlButton(ctx.phone,
    `🔍 *Şimdi arama kriterlerinize uygun olarak en yeni ilanları birlikte görelim.*\n\nAşağıdaki formdan ilan tipi, mülk tipi ve fiyat aralığını seçin — son 24 saatte yayınlanan uyan sahibi ilanlar altta dökülecek.\n\n💡 Aynı sayfada mülk tipini değiştirerek farklı sonuçlara da ulaşabilirsiniz.\n\n_(Bu sayfaya istediğiniz zaman ana menü > 🔍 Portföy Ara komutu ile geri dönebilirsiniz.)_`,
    "🔍 Hızlı Arama",
    araUrl,
    { skipNav: true },
  );

  return true;
}

/**
 * Bayi intro — UPU first-person + 5 yetenek vaadi + "Başlayalım" CTA.
 *
 * Bayi'de public veri yok (B2B veri her firmaya özel) — emlak'ın
 * value-first demo'su yerine doğrudan kısa onboarding'e bağlanıyoruz.
 * Onboarding (3 soru) bittiğinde bayi/onboarding-flow.ts onFinish
 * startBayiDiscoveryChain'i tetikler ve firma profili magic link akışı
 * başlar.
 */
async function startBayiIntro(ctx: WaContext): Promise<boolean> {
  const introMsg =
    `👋 Merhaba! Ben UPU, bayi yönetim asistanınız. 7/24 dağıtım operasyonunuzu kolaylaştıracağım.\n\n` +
    `*Yapabileceklerimden bazıları:*\n\n` +
    `• Her sabah günlük brifing — açık siparişler, kritik stok, vadesi gelen ödemeler özet\n` +
    `• Bayilerinizden gelen siparişleri telefonla çağırınca tek tıkla sisteme kaydederim\n` +
    `• Vadesi yaklaşan tahsilatlar için otomatik hatırlatma metni hazırlarım, onayınızla bayiye gönderirim\n` +
    `• Tüm bayilerinize tek tıkla kampanya duyurusu yaparım — %10 indirim, hızlı sipariş kampanyası gibi\n` +
    `• Stok kritik seviyeye düşünce uyarır, tedarikçi sipariş önerisi sunarım`;

  await sendText(ctx.phone, introMsg);

  await sendButtons(ctx.phone, "Şimdi sizi tanıyayım! 👇",
    [{ id: "vf:start", title: "🚀 Başlayalım" }],
    { skipNav: true },
  );

  return true;
}

/**
 * Handle intro callback taps.
 *
 * Callback ID formats (current):
 *   vf:start             → begin onboarding (emlak/bayi)
 *   vf:bayi_onay         → bayi profil magic link
 *   vf:bayi_sonra        → bayi geç-bırak
 *
 * (Eski emlak chain callback'leri vf:region/vf:type/vf:listing/vf:listed
 * 2026-04 startIntro emlak refactor'unda kaldırıldı — chain artık demo
 * arama linkiyle başlıyor, callback bağımlılığı yok.)
 */
export async function handleIntroCallback(ctx: WaContext, interactiveId: string): Promise<void> {
  const parts = interactiveId.split(":");
  if (parts[0] !== "vf") return;

  const step = parts[1];

  if (step === "start") {
    // Bayi: WA onboarding atlandı — onay mesajı gösterip tek-form web akışına yönlendiriyoruz.
    if (ctx.tenantKey === "bayi") {
      const onayMsg =
        `📝 *Sistemi kullanmaya hazır olmak için aşağıdaki bilgileri sizden alacağım:*\n\n` +
        `• Firma adı, sektör, bayi sayısı\n` +
        `• Yetkili adı, telefon, e-posta\n` +
        `• Ofis adresi\n` +
        `• Brifing tercihiniz (sabah günlük özet ister misiniz)\n` +
        `• (Opsiyonel) Vergi bilgileri, IBAN, kısa tanıtım\n\n` +
        `⏱ Tahmini süre: ~5 dakika.\n` +
        `Tek formda hızlıca dolduracağız.`;
      await sendButtons(ctx.phone, onayMsg, [
        { id: "vf:bayi_onay", title: "✅ Tamam, başlayalım" },
        { id: "vf:bayi_sonra", title: "❌ Sonra" },
      ], { skipNav: true });
      return;
    }

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

  // Bayi: "✅ Tamam, başlayalım" → magic link bayi-profil web form
  if (step === "bayi_onay") {
    const { randomBytes } = await import("crypto");
    const { sendUrlButton } = await import("./send");
    const sb = getServiceClient();
    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from("magic_link_tokens").insert({
      user_id: ctx.userId, token, expires_at: expiresAt,
    });
    const url = `https://retailai.upudev.nl/tr/bayi-profil?t=${token}`;
    await sendUrlButton(ctx.phone,
      `🏢 *Firma Profili*\n\nAşağıdaki butona tıklayıp formu doldurun. Tüm bilgileri tek seferde gireceğiz; opsiyonelleri sonra da tamamlayabilirsiniz.`,
      "📝 Form'u Aç",
      url,
      { skipNav: true },
    );
    return;
  }

  // Bayi: "❌ Sonra" → menüden firmaprofili komutu ile ulaşılabilir
  if (step === "bayi_sonra") {
    await sendButtons(ctx.phone,
      `✅ Anlaşıldı. Hazır olduğunuzda menüden *🏢 Firma Profili*'ne tıklayın veya *"profilim"* yazın.\n\n` +
      `_Sipariş, kampanya, bayi davet gibi işlemler firma profili tamamlanmadan kullanılamaz — sadece okuma komutları (özet, rapor) çalışır._`,
      [{ id: "cmd:menu", title: "📋 Ana Menü" }],
    );
    return;
  }
}
