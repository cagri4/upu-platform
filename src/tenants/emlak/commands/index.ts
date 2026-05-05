/**
 * Emlak Tenant — Command Registry
 *
 * Killer commands only. Gamification removed. Single-assistant UX.
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

import { handleMulkEkle, handleMulkEkleMenu, handleMulkEkleForm, handleMulkEkleStep, handleMulkEkleCallback, handleDevam } from "./mulk-ekle";
import { handleTamamlaCallback, handleTamamlaStep, handleTamamlaRooms } from "./tamamla";
import { handleFiyatBelirle, handleFiyatBelirleCallback } from "./fiyat-belirle";
import { handleMusteriler } from "./musteriler";
import { handleSozlesmelerim, handleWebpanel, handleSozlesme, handleSozlesmeStep, handleSozlesmeCallback } from "./sozlesme";
import { handleMusteriEkle, handleMusteriEkleStep, handleMusteriEkleCallback } from "./musteri-ekle";
import { handleMusteriDuzenle, handleMusteriDuzenleCallback, handleMusteriDuzenleStep } from "./musteri-duzenle";
import { handleMusteriSil, handleMusteriSilCallback } from "./musteri-sil";
import { handleEslestir, handleEslestirCallback } from "./eslestir";
import { handleHatirlatma, handleHatirlatmaStep, handleHatirlatmaCallback } from "./hatirlatma";
import { handleTakipEt, handleTakipEtStep, handleTakipEtCallback } from "./takip-et";
import { handleSatisTavsiye, handleSatisTavsiyeCallback } from "./satis-tavsiye";
import { handleMusteriTakip, handleMusteriTakipCallback } from "./musteri-takip";
import { handleFotograf, handleFotografCallback, handlePaylas, handlePaylasCallback } from "./medya";
import { handleSunum, handleSunumStep, handleSunumCallback, handleSunumlarim } from "./sunum";
import { handleIpucu, handleTipCallback } from "./ipucu";
import { handleIlanTakip } from "./ilan-takip";
import { handlePortfoyAra } from "./portfoy-ara";
import { handleSunumOlustur } from "./sunum-olustur";
import { handleMulklerim } from "./mulklerim";
import { handleProfilDuzenle } from "./profil-duzenle";
import { handleWebSayfam } from "./web-sayfam";
import { handleYardim } from "./yardim";

export const emlakCommands: TenantCommandRegistry = {
  commands: {
    // Core killer commands
    mulkekle: handleMulkEkleMenu,
    devam: handleDevam,
    fiyatbelirle: handleFiyatBelirle,
    musteriEkle: handleMusteriEkle,
    musteriTakip: handleMusteriTakip,
    sunum: handleSunum,
    sunumolustur: handleSunumOlustur,
    portfoyara: handlePortfoyAra,
    mulklerim: handleMulklerim,
    profilduzenle: handleProfilDuzenle,
    websayfam: handleWebSayfam,
    eslestir: handleEslestir,
    ilantakip: handleIlanTakip,

    // Supporting (hidden but working)
    musterilerim: handleMusteriler,
    musteriDuzenle: handleMusteriDuzenle,
    musterisil: handleMusteriSil,
    hatirlatma: handleHatirlatma,
    takipEt: handleTakipEt,
    satistavsiye: handleSatisTavsiye,
    sunumlarim: handleSunumlarim,
    fotograf: handleFotograf,
    paylas: handlePaylas,
    sozlesme: handleSozlesme,
    sozlesmelerim: handleSozlesmelerim,
    webpanel: handleWebpanel,
    ipucu: handleIpucu,
    yardim: handleYardim,
  },
  stepHandlers: {
    mulkekle: handleMulkEkleStep,
    tamamla: handleTamamlaStep,
    musteriEkle: handleMusteriEkleStep,
    musteriDuzenle: handleMusteriDuzenleStep,
    hatirlatma: handleHatirlatmaStep,
    takipEt: handleTakipEtStep,
    sozlesme: handleSozlesmeStep,
    sunum: handleSunumStep,
  },
  callbackPrefixes: {
    "mulkekle_method:": async (ctx, callbackData) => {
      const method = callbackData.replace("mulkekle_method:", "");
      if (method === "form") {
        await handleMulkEkleForm(ctx);
      } else if (method === "hizli") {
        await handleMulkEkle(ctx);
      }
    },
    "mulkekle:": handleMulkEkleCallback,
    "tamamla:": handleTamamlaCallback,
    "tmm:rooms:": handleTamamlaRooms,
    "mustekle:": handleMusteriEkleCallback,
    "md_select:": handleMusteriDuzenleCallback,
    "md_edit:": handleMusteriDuzenleCallback,
    "mustsil:": handleMusteriSilCallback,
    "esles:": handleEslestirCallback,
    "htrt:": handleHatirlatmaCallback,
    "tkp:": handleTakipEtCallback,
    "st:": handleSatisTavsiyeCallback,
    "mt:": handleMusteriTakipCallback,
    "foto_select:": handleFotografCallback,
    "foto_done": handleFotografCallback,
    "paylas_select:": handlePaylasCallback,
    "fb:": handleFiyatBelirleCallback,
    "szl:": handleSozlesmeCallback,
    "snm:": handleSunumCallback,
    "tip:": handleTipCallback,
  },
  aliases: {
    "görevlere devam": "devam",
    "göreve devam": "devam",
    "gorevlere devam": "devam",
    "devam et": "devam",
    "müşteriler": "musterilerim",
    "müşterilerim": "musterilerim",
    "müşteri sil": "musterisil",
    "musteri sil": "musterisil",
    "müşterisil": "musterisil",
    "fiyat": "fiyatbelirle",
    "fiyatsor": "fiyatbelirle",
    "sözleşme": "sozlesme",
    "sözleşmelerim": "sozlesmelerim",
    "kontrat": "sozlesme",
    "panel": "webpanel",
    "dashboard": "webpanel",
    "fotoğraf": "fotograf",
    "sunumlar": "sunumlarim",
    "sunumlarım": "sunumlarim",
    "prezentasyon": "sunum",
    "sunum oluştur": "sunumolustur",
    "sunum olustur": "sunumolustur",
    "sunumoluştur": "sunumolustur",
    "portföy ara": "portfoyara",
    "portfoy ara": "portfoyara",
    "portföyara": "portfoyara",
    "ilan ara": "portfoyara",
    "hızlı arama": "portfoyara",
    "hizli arama": "portfoyara",
    "mülklerim": "mulklerim",
    "mülkleri yönet": "mulklerim",
    "mulkleri yonet": "mulklerim",
    "portföyüm": "mulklerim",
    "portfoyum": "mulklerim",
    "profil düzenle": "profilduzenle",
    "profil duzenle": "profilduzenle",
    "profil": "profilduzenle",
    "web sayfam": "websayfam",
    "web sayfası": "websayfam",
    "websitem": "websayfam",
    "landing": "websayfam",
    "ipuclari": "ipucu",
    "ipuçları": "ipucu",
    "tip": "ipucu",
    "tipler": "ipucu",
    "yardım": "yardim",
    "help": "yardim",
    "rehber": "yardim",
    "kılavuz": "yardim",
  },
};
