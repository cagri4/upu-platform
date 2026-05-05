/**
 * Emlak ana komut menüsü — free-ride pattern.
 *
 * Onboarding sonrası ve /menü komutu çağrılırken kullanılır. Tour yok;
 * kullanıcı istediği komuta direkt gider. Yardım için ayrı /yardim
 * komutu (handleYardim → /tr/yardim sayfası).
 *
 * TEK mesaj: kategorize list (Yardım URL button kaldırıldı 2026-05-05 —
 * "yeni kullanıcı sadece 2 mesaj görmeli" gereksinimi: intro + bu menü).
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendList } from "@/platform/whatsapp/send";

/** Menüde gösterilen komutlar. */
export const EMLAK_MENU_SECTIONS: Array<{
  title: string;
  rows: Array<{ id: string; title: string; description: string }>;
}> = [
  {
    title: "🏠 Mülk",
    rows: [
      { id: "cmd:mulkekle",   title: "Mülk Ekle",     description: "Form veya hızlı giriş" },
      { id: "cmd:mulklerim",  title: "Mülklerim",     description: "Portföy listesi (web)" },
      { id: "cmd:fotograf",   title: "Fotoğraf",      description: "Mevcut mülke foto ekle" },
    ],
  },
  {
    title: "👥 Müşteri",
    rows: [
      { id: "cmd:musteriEkle",   title: "Müşteri Ekle",  description: "Form ile alıcı/kiracı kaydı" },
      { id: "cmd:musterilerim",  title: "Müşterilerim",  description: "Liste + edit/sil (web)" },
      { id: "cmd:eslestir",      title: "Eşleştir",      description: "Müşteri kriterine uyan mülk" },
    ],
  },
  {
    title: "🎯 Sunum & Sözleşme",
    rows: [
      { id: "cmd:sunumolustur",  title: "Sunum Oluştur",  description: "AI metinli müşteri sunumu" },
      { id: "cmd:sunumlarim",    title: "Sunumlarım",     description: "Önceki sunumlar (web)" },
      { id: "cmd:sozlesme",      title: "Sözleşme Yap",   description: "Yetkilendirme + imza linki" },
      { id: "cmd:sozlesmelerim", title: "Sözleşmelerim",  description: "Sözleşme arşivi" },
    ],
  },
  {
    title: "📡 Pazar Tarama",
    rows: [
      { id: "cmd:portfoyara",  title: "Portföy Ara",   description: "Yeni sahibi ilanlarını filtrele" },
      { id: "cmd:ilantakip",   title: "İlan Takip",    description: "Sabah brifingi kriterleri" },
      { id: "cmd:hatirlatma",  title: "Hatırlatma",    description: "Müşteri arama hatırlatmaları" },
    ],
  },
  {
    title: "🪪 Profil & Yardım",
    rows: [
      { id: "cmd:profilduzenle", title: "Profilim",     description: "Ad, ofis, foto güncelle" },
      { id: "cmd:websayfam",     title: "Web Sayfam",   description: "Public landing düzenle" },
      { id: "cmd:webpanel",      title: "Web Panel",    description: "Tarayıcıda yönetim paneli" },
      { id: "cmd:yardim",        title: "❓ Yardım",     description: "Komut kullanım rehberi" },
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
        `Aşağıdaki menüden bir komut seç veya doğrudan komut adını yaz (örn. *mulkekle*, *sunum*).\n\n` +
        `Her komutun kullanımını öğrenmek için *yardim* yaz.`
      )
    : (
        `📋 *Komutlar*\n\n` +
        `Listeden seç ya da komut adını yaz. Komut kılavuzu için *yardim* yaz.`
      );

  await sendList(ctx.phone, intro, "Komut Seç", EMLAK_MENU_SECTIONS, { skipNav: true });
}
