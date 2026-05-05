/**
 * Emlak ana komut menüsü — free-ride pattern.
 *
 * Onboarding sonrası ve /menü komutu çağrılırken kullanılır. Tour yok;
 * kullanıcı istediği komuta direkt gider, her komutun yanında "❓ Yardım"
 * linki ile tutorial sayfasına ulaşır.
 *
 * Ana menü list message + ayrı bir Yardım Merkezi URL button.
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendList, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

/** Menüde gösterilen komutlar. Tutorial sayfası olanlar `tutorial: true`. */
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
    title: "🪪 Profil & Web",
    rows: [
      { id: "cmd:profilduzenle", title: "Profilim",     description: "Ad, ofis, foto güncelle" },
      { id: "cmd:websayfam",     title: "Web Sayfam",   description: "Public landing düzenle" },
      { id: "cmd:webpanel",      title: "Web Panel",    description: "Tarayıcıda yönetim paneli" },
    ],
  },
];

/**
 * Ana komut menüsü mesajını gönderir + Yardım Merkezi URL button.
 *
 * @param greet Eğer true ise üst kısma "Sistemimiz hazır" karşılaması ekler
 *              (onboarding finish'te). Normal /menü çağrısında false.
 */
export async function sendEmlakMenu(ctx: Pick<WaContext, "userId" | "phone" | "userName">, greet = false): Promise<void> {
  const firstName = (ctx.userName || "").split(/\s+/)[0] || "";

  const intro = greet
    ? (
        `🎉 *Sistemimiz hazır!*\n\n` +
        (firstName ? `Hoş geldin ${firstName}. ` : "") +
        `Ekibin senin için 7/24 çalışmaya başladı.\n\n` +
        `Aşağıdaki menüden istediğin komutu seçebilirsin — ya da doğrudan komut adını yazabilirsin (örn. "mulkekle", "sunum").\n\n` +
        `Her komutun nasıl kullanıldığını öğrenmek için ❓ *Yardım Merkezi* butonuna tıkla.`
      )
    : (
        `📋 *Komutlar*\n\n` +
        `Listeden seç ya da komut adını yaz. Yardım için ❓ butonuna tıkla.`
      );

  await sendList(ctx.phone, intro, "Komut Seç", EMLAK_MENU_SECTIONS, { skipNav: true });

  // Yardım merkezi magic link
  const sb = getServiceClient();
  const token = randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({ user_id: ctx.userId, token, expires_at: expires });

  const url = `${APP_URL}/tr/yardim?t=${token}`;
  await sendUrlButton(
    ctx.phone,
    "❓ Tüm komutların nasıl kullanıldığını gör — örnekli, görsel anlatım:",
    "❓ Yardım Merkezi",
    url,
    { skipNav: true },
  );
}
