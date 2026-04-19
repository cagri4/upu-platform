/**
 * Emlak Tenant — Command Registry
 *
 * Killer commands only. Gamification removed. Single-assistant UX.
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

import { handleMulkEkle, handleMulkEkleMenu, handleMulkEkleStep, handleMulkEkleCallback, handleDevam } from "./mulk-ekle";
import { handleFiyatBelirle, handleFiyatBelirleCallback } from "./fiyat-belirle";
import { handleMusteriler } from "./musteriler";
import { handleSozlesmelerim, handleWebpanel, handleSozlesme, handleSozlesmeStep, handleSozlesmeCallback } from "./sozlesme";
import { handleTara, handleTaraStep, handleEkle } from "./portfolio";
import { handleMusteriEkle, handleMusteriEkleStep, handleMusteriEkleCallback } from "./musteri-ekle";
import { handleMusteriDuzenle, handleMusteriDuzenleCallback, handleMusteriDuzenleStep } from "./musteri-duzenle";
import { handleEslestir, handleEslestirCallback } from "./eslestir";
import { handleHatirlatma, handleHatirlatmaStep, handleHatirlatmaCallback } from "./hatirlatma";
import { handleTakipEt, handleTakipEtStep, handleTakipEtCallback } from "./takip-et";
import { handleSatisTavsiye, handleSatisTavsiyeCallback } from "./satis-tavsiye";
import { handleMusteriTakip, handleMusteriTakipCallback } from "./musteri-takip";
import { handleFotograf, handleFotografCallback, handlePaylas, handlePaylasCallback } from "./medya";
import { handleSunum, handleSunumStep, handleSunumCallback, handleSunumlarim } from "./sunum";
import { handleIpucu, handleTipCallback } from "./ipucu";

export const emlakCommands: TenantCommandRegistry = {
  commands: {
    // Core killer commands
    mulkekle: handleMulkEkleMenu,
    devam: handleDevam,
    fiyatbelirle: handleFiyatBelirle,
    musteriEkle: handleMusteriEkle,
    musteriTakip: handleMusteriTakip,
    sunum: handleSunum,
    eslestir: handleEslestir,

    // Supporting (hidden but working)
    musterilerim: handleMusteriler,
    musteriDuzenle: handleMusteriDuzenle,
    hatirlatma: handleHatirlatma,
    takipEt: handleTakipEt,
    satistavsiye: handleSatisTavsiye,
    sunumlarim: handleSunumlarim,
    fotograf: handleFotograf,
    paylas: handlePaylas,
    sozlesme: handleSozlesme,
    sozlesmelerim: handleSozlesmelerim,
    webpanel: handleWebpanel,
    tara: handleTara,
    ekle: handleEkle,
    ipucu: handleIpucu,
  },
  stepHandlers: {
    mulkekle: handleMulkEkleStep,
    tara: handleTaraStep,
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
      if (method === "link") {
        await handleTara(ctx);
      } else if (method === "detayli") {
        await handleMulkEkle(ctx);
      } else if (method === "hizli") {
        const { startSession } = await import("@/platform/whatsapp/session");
        const { sendText } = await import("@/platform/whatsapp/send");
        await startSession(ctx.userId, ctx.tenantId, "mulkekle", "title");
        await sendText(ctx.phone, "⚡ Hızlı ekleme — ilan başlığını yazın:\n\nÖrnek: Kadıköy 3+1 2.5M satılık");
      }
    },
    "mulkekle:": handleMulkEkleCallback,
    "mustekle:": handleMusteriEkleCallback,
    "md_select:": handleMusteriDuzenleCallback,
    "md_edit:": handleMusteriDuzenleCallback,
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
    "müşteriler": "musterilerim",
    "müşterilerim": "musterilerim",
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
    "ipuclari": "ipucu",
    "ipuçları": "ipucu",
    "tip": "ipucu",
    "tipler": "ipucu",
  },
};
