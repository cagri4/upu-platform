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
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

/**
 * "Paneli Aç" CTA mesajı gönderir.
 *
 * @param greet Onboarding finish'te true → "Sistemimiz hazır" hoşgeldin tonu.
 *              /menü çağrısında false → kısa "Yönetim Paneliniz".
 */
export async function sendEmlakMenu(ctx: Pick<WaContext, "userId" | "phone" | "userName">, greet = false): Promise<void> {
  const firstName = (ctx.userName || "").split(/\s+/)[0] || "";

  const supabase = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({ user_id: ctx.userId, token, expires_at: expiresAt });

  const url = `${APP_URL}/tr/panel?t=${token}`;

  const text = greet
    ? (
        `🎉 *Sistemimiz hazır!*\n\n` +
        (firstName ? `Hoş geldin ${firstName}. ` : "") +
        `Yönetim panelinizden tüm komutları görsel kartlarla keşfedin — her komutun ne işe yaradığını ❓ butonuyla öğrenin, "Başlat" ile hemen kullanmaya başlayın.\n\n` +
        `_Hızlı erişim: WhatsApp'tan komut adını yazabilirsiniz (örn. *mulkekle*, *musterilerim*, *yardim*)._`
      )
    : (
        `🖥 *Yönetim Paneliniz*\n\n` +
        `Tüm komutları kart layout'unda görüntülemek için panele girin.\n\n` +
        `_Hızlı erişim için WhatsApp'tan komut adını da yazabilirsiniz._`
      );

  await sendUrlButton(ctx.phone, text, "🖥 Paneli Aç", url, { skipNav: true });
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
  const sb = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({ user_id: ctx.userId, token, expires_at: expiresAt });

  const url = `${APP_URL}/tr/yardim/${command}?t=${token}`;
  await sendUrlButton(
    ctx.phone,
    "❓ Bu komutu nasıl kullanırım?",
    "❓ Yardım",
    url,
    { skipNav: true },
  );
}
