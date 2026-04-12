/**
 * Emlak Tenant — Command Registry
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

// ── Active commands ────────────────────────────────────────────────
import { handlePortfoyum } from "./portfoyum";
import { handleMulkEkle, handleMulkEkleMenu, handleMulkEkleStep, handleMulkEkleCallback } from "./mulk-ekle";
import { handleFiyatBelirle, handleFiyatBelirleCallback } from "./fiyat-belirle";
import { handleBrifing } from "./brifing";
import { handleMusteriler } from "./musteriler";
import { handleGorevler } from "./gorevler";
import { handleSozlesmelerim, handleWebpanel, handleSozlesme, handleSozlesmeStep, handleSozlesmeCallback } from "./sozlesme";
import { handleRapor } from "./rapor";
import { handleMulkDetay, handleMulkDetayCallback, handleMulkDuzenle, handleMulkDuzenleCallback, handleMulkEditFieldCallback, handleMulkDuzenleStep, handleMulkSil, handleMulkSilCallback, handleMulkYonet, handleMulkYonetSelectCallback, handleMulkYonetActionCallback, handleAiDescCallback, handleAiDescWizardStep } from "./mulk-yonetim";
import { handleTara, handleTaraStep, handleEkle } from "./portfolio";
import { handleMusteriEkle, handleMusteriEkleStep, handleMusteriEkleCallback } from "./musteri-ekle";
import { handleMusteriDuzenle, handleMusteriDuzenleCallback, handleMusteriDuzenleStep } from "./musteri-duzenle";
import { handleEslestir, handleEslestirCallback } from "./eslestir";
import { handleHatirlatma, handleHatirlatmaStep, handleHatirlatmaCallback } from "./hatirlatma";
import { handleTakipEt, handleTakipEtStep, handleTakipEtCallback } from "./takip-et";
import { handleSatisTavsiye, handleSatisTavsiyeCallback } from "./satis-tavsiye";
import { handleOrtakPazar, handleOrtakPazarCallback } from "./ortak-pazar";
import { handleFotograf, handleFotografCallback, handlePaylas, handlePaylasCallback, handleYayinla, handleYayinlaCallback } from "./medya";
import { handleWebsitem, handleWebsitemStep, handleWebsitemCallback } from "./websitem-wizard";
import { handleMulkOner, handleMulkOnerStep } from "./degerle";
import { handleHediyeler, handleHediyelerCallback } from "./hediyeler";
import { handleSunum, handleSunumStep, handleSunumCallback, handleSunumlarim } from "./sunum";

export const emlakCommands: TenantCommandRegistry = {
  commands: {
    // Portföy Sorumlusu
    portfoyum: handlePortfoyum,
    portfoy: handlePortfoyum,
    mulkekle: handleMulkEkle,
    mulkdetay: handleMulkDetay,
    mulkduzenle: handleMulkDuzenle,
    mulksil: handleMulkSil,
    mulkyonet: handleMulkYonet,
    tara: handleTara,
    ekle: handleEkle,

    // Satış Destek
    musterilerim: handleMusteriler,
    musteriEkle: handleMusteriEkle,
    musteriDuzenle: handleMusteriDuzenle,
    eslestir: handleEslestir,
    hatirlatma: handleHatirlatma,
    takipEt: handleTakipEt,
    satistavsiye: handleSatisTavsiye,
    ortakpazar: handleOrtakPazar,
    sunum: handleSunum,
    sunumlarim: handleSunumlarim,

    // Medya Uzmanı
    fotograf: handleFotograf,
    yayinla: handleYayinla,
    paylas: handlePaylas,
    websitem: handleWebsitem,

    // Pazar Analisti
    fiyatbelirle: handleFiyatBelirle,
    mulkoner: handleMulkOner,
    rapor: handleRapor,

    // Sekreter
    brifing: handleBrifing,
    gorevler: handleGorevler,
    sozlesme: handleSozlesme,
    sozlesmelerim: handleSozlesmelerim,
    hediyeler: handleHediyeler,
    webpanel: handleWebpanel,
  },
  stepHandlers: {
    mulkekle: handleMulkEkleStep,
    tara: handleTaraStep,
    musteriEkle: handleMusteriEkleStep,
    musteriDuzenle: handleMusteriDuzenleStep,
    mulkduzenle: handleMulkDuzenleStep,
    ai_desc_wizard: handleAiDescWizardStep,
    hatirlatma: handleHatirlatmaStep,
    takipEt: handleTakipEtStep,
    mulkoner: handleMulkOnerStep,
    sozlesme: handleSozlesmeStep,
    websitem: handleWebsitemStep,
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
    "mulkdetay:": handleMulkDetayCallback,
    "mulkduzenle:": handleMulkDuzenleCallback,
    "mulkedit:": handleMulkEditFieldCallback,
    "mulksil:": handleMulkSilCallback,
    "mulksil_ok:": handleMulkSilCallback,
    "mulkyonet_select:": handleMulkYonetSelectCallback,
    "mulkyonet_act:": handleMulkYonetActionCallback,
    "mustekle:": handleMusteriEkleCallback,
    "md_select:": handleMusteriDuzenleCallback,
    "md_edit:": handleMusteriDuzenleCallback,
    "esles:": handleEslestirCallback,
    "htrt:": handleHatirlatmaCallback,
    "tkp:": handleTakipEtCallback,
    "st:": handleSatisTavsiyeCallback,
    "op:": handleOrtakPazarCallback,
    "foto_select:": handleFotografCallback,
    "foto_done": handleFotografCallback,
    "ai_desc:": handleAiDescCallback,
    "paylas_select:": handlePaylasCallback,
    "pub:": handleYayinlaCallback,
    "fb:": handleFiyatBelirleCallback,
    "hdy:": handleHediyelerCallback,
    "szl:": handleSozlesmeCallback,
    "snm:": handleSunumCallback,
    "websitem_action:": handleWebsitemCallback,
    "websitem_theme:": handleWebsitemCallback,
  },
  aliases: {
    "portföy": "portfoyum",
    "portföyüm": "portfoyum",
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
  },
};
