/**
 * Emlak WA menü/selamlama — Yönetim Paneli pattern.
 *
 * Onboarding sonrası ve /menü komutu çağrılırken kullanıcıya tek bir
 * CTA URL button gönderilir: "🖥 Paneli Aç" → /tr/panel sayfası.
 * Web panel kartlı komut grid'i + (?) modal pazarlama dili tutorial +
 * "Başlat" launcher içerir.
 *
 * Eski WA list message ("Komut Seç") kaldırıldı (2026-05-05) — kart
 * layout web tarafında daha görsel zengin demo değeri verir.
 *
 * sendCommandHelp(): komut handler'ları kendi response'undan sonra
 * "❓ Bu komutu nasıl kullanırım?" URL button gönderir; kullanıcı
 * tutorial sayfasına tek tıkla ulaşır.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendUrlButton } from "@/platform/whatsapp/send";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

/**
 * "Paneli Aç" CTA mesajı gönderir.
 *
 * @param greet Onboarding finish'te true → "Sistemimiz hazır" hoşgeldin tonu.
 *              /menü çağrısında false → kısa "Yönetim Paneliniz".
 */
export async function sendEmlakMenu(ctx: Pick<WaContext, "userId" | "phone" | "userName">, greet = false): Promise<void> {
  const firstName = (ctx.userName || "").split(/\s+/)[0] || "";

  // 2026-05-08: external-redirect (Seçenek A) — Android'de intent:// ile
  // Chrome'a, iOS'da Safari'ye breakout dener; başarısızsa evergreen'e
  // fallback (yine multi-tenant safe uid lookup). Eski direct evergreen
  // WA WebView içinde açıyordu — fix.
  const url = `${APP_URL}/api/panel/external-redirect?uid=${encodeURIComponent(ctx.userId)}`;

  const text = greet
    ? (
        `🎉 *Sistemimiz hazır!*\n\n` +
        (firstName ? `Hoş geldin ${firstName}. ` : "") +
        `Tüm komutları görüntülemek için panele gidin — her komutun ❓ butonuyla ne yapacağını öğrenin, "Başlat" ile hemen kullanmaya başlayın.\n\n` +
        `_Hızlı erişim: WhatsApp'tan komut adını yazabilirsiniz (örn. *mulkekle*, *musterilerim*, *yardim*)._`
      )
    : (
        `🖥 *Yönetim Paneliniz*\n\n` +
        `Tüm komutları görüntülemek için panele gidin.\n\n` +
        `_Hızlı erişim için WhatsApp'tan komut adını da yazabilirsiniz._`
      );

  await sendUrlButton(ctx.phone, text, "🖥 Panele Git", url, { skipNav: true });
}

/**
 * Komut handler'ı response'undan sonra çağrılır — küçük "❓ Bu komutu
 * nasıl kullanırım?" URL button mesajı, /tr/yardim/[command] tutorial
 * sayfasına yönlendirir. Magic link 7 gün geçerli.
 *
 * Sadece tutorial içeriği olan 7 komut için anlamlı (yardim-content.ts
 * entry'leri). Olmayanı yine sayfaya yönlendirir, "bu komut için yardım
 * yok" mesajı görür.
 */
export async function sendCommandHelp(
  ctx: Pick<WaContext, "userId" | "phone">,
  command: string,
): Promise<void> {
  // 2026-05-06: "❓ Yardım" button yerine "🖥 Panele Git" — kullanıcı her
  // komut sonrası kontrol noktasına dönebilir, başka komut başlatabilir.
  // 2026-05-08: pre-mint token kaldırıldı, external-redirect (Seçenek A)
  // kullanılır — Android Chrome / iOS Safari breakout, WebView dışına çık.
  const panelUrl = `${APP_URL}/api/panel/external-redirect?uid=${encodeURIComponent(ctx.userId)}`;
  const tutorialUrl = `${APP_URL}/tr/yardim/${command}`;

  await sendUrlButton(
    ctx.phone,
    `🖥 Tüm komutları görmek için panele dönebilirsin.\n\n_Bu komutun nasıl kullanıldığı:_ ${tutorialUrl}`,
    "🖥 Panele Git",
    panelUrl,
    { skipNav: true },
  );
}

/**
 * Save endpoint'lerinde ana CTA mesajından (örn. "Web Sayfamı Aç",
 * "Sunumu Gör") sonra ikinci mesaj olarak gönderilen kısa "Panele Git"
 * URL button. Token 1 saat TTL — panele dönüş hızlı kullanım içindir.
 *
 * WA Cloud API'da reply + URL button mix yok; bu yüzden ana CTA + Panele
 * Git ayrı 2 mesaj olarak gönderilir.
 */
export async function sendBackToPanel(
  userId: string,
  phone: string,
): Promise<void> {
  // 2026-05-08: external-redirect (Seçenek A) — Android'de intent:// ile
  // Chrome'a, iOS'da Safari'ye breakout dener; başarısızsa evergreen'e
  // fallback. Önceki direct evergreen URL WA WebView içinde açılıyordu.
  void phone;
  const panelUrl = `${APP_URL}/api/panel/external-redirect?uid=${encodeURIComponent(userId)}`;
  await sendUrlButton(
    phone,
    "Diğer komutlar için panele dönebilirsiniz.",
    "🖥 Panele Git",
    panelUrl,
    { skipNav: true },
  );
}
