/**
 * Emlak ana komut menüsü — free-ride pattern (Hibrit C).
 *
 * WA list message hard limit: 10 row total. 9 öncelikli komut + 1 yardım
 * row. Diğer komutlar için intro text'inde "*yardim* yaz" ipucu.
 *
 * sendCommandHelp(): kritik komut handler'ları kendi response'larından
 * sonra "❓ Bu komutu nasıl kullanırım?" URL button gönderir; kullanıcı
 * tutorial'a tek tıkla ulaşır.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendList, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

/**
 * Ana menü — WA list 10-row limit'i içinde 9 öncelikli komut + Yardım.
 * 2 section (toplam 9 row).
 */
export const EMLAK_MENU_SECTIONS: Array<{
  title: string;
  rows: Array<{ id: string; title: string; description: string }>;
}> = [
  {
    title: "🏠 Mülk & Müşteri",
    rows: [
      { id: "cmd:mulkekle",     title: "Mülk Ekle",     description: "Form veya hızlı giriş" },
      { id: "cmd:mulklerim",    title: "Mülklerim",     description: "Portföy listesi (web)" },
      { id: "cmd:musteriEkle",  title: "Müşteri Ekle",  description: "Alıcı / kiracı kaydı" },
      { id: "cmd:musterilerim", title: "Müşterilerim",  description: "Liste + edit/sil (web)" },
    ],
  },
  {
    title: "🎯 İş Akışı",
    rows: [
      { id: "cmd:sunumolustur", title: "Sunum Oluştur",  description: "AI metinli müşteri sunumu" },
      { id: "cmd:sozlesme",     title: "Sözleşme Yap",   description: "Yetkilendirme + imza linki" },
      { id: "cmd:portfoyara",   title: "Portföy Ara",    description: "Yeni sahibi ilanlarını filtrele" },
      { id: "cmd:profilduzenle", title: "Profilim",      description: "Ad, ofis, foto güncelle" },
      { id: "cmd:yardim",       title: "❓ Yardım",       description: "Komut kullanım rehberi" },
    ],
  },
];

/**
 * Ana komut menüsü mesajını gönderir.
 *
 * @param greet Onboarding finish'te true → "Sistemimiz hazır" başlığı.
 *              /menü çağrısında false → kısa "Komutlar" başlığı.
 */
export async function sendEmlakMenu(ctx: Pick<WaContext, "userId" | "phone" | "userName">, greet = false): Promise<void> {
  const firstName = (ctx.userName || "").split(/\s+/)[0] || "";

  const intro = greet
    ? (
        `🎉 *Sistemimiz hazır!*\n\n` +
        (firstName ? `Hoş geldin ${firstName}. ` : "") +
        `Aşağıdaki menüden komut seç ya da komut adını yaz.\n\n` +
        `_Diğer komutlar (eşleştir, hatırlatma, fotograf, sözleşmelerim, sunumlarım, web sayfam, web panel...) için *yardim* yaz._`
      )
    : (
        `📋 *Komutlar*\n\n` +
        `Listeden seç ya da komut adını yaz.\n\n` +
        `_Tüm komutlar için *yardim* yaz._`
      );

  await sendList(ctx.phone, intro, "Komut Seç", EMLAK_MENU_SECTIONS, { skipNav: true });
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
