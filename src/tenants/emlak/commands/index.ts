/**
 * Emlak Tenant — Command Registry
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

// ── Active commands (already ported) ────────────────────────────────
import { handlePortfoyum } from "./portfoyum";
import { handleMulkEkle, handleMulkEkleStep, handleMulkEkleCallback } from "./mulk-ekle";
import { handleFiyatSor } from "./fiyat-sor";
import { handleBrifing } from "./brifing";
import { handleMusteriler } from "./musteriler";
import { handleGorevler } from "./gorevler";
import { handleSozlesmelerim, handleWebpanel, handleSozlesme, handleSozlesmeStep, handleSozlesmeCallback } from "./sozlesme";
import { handleAnaliz, handleRapor } from "./analiz";

// ── Newly ported commands ────────────────────────────────────────────
import { handleMulkDetay, handleMulkDetayCallback, handleMulkDuzenle, handleMulkDuzenleCallback, handleMulkEditFieldCallback, handleMulkDuzenleStep, handleMulkSil, handleMulkSilCallback } from "./mulk-yonetim";
import { handleTara, handleTaraStep, handleEkle } from "./portfolio";
import { handleMusteriEkle, handleMusteriEkleStep, handleMusteriEkleCallback } from "./musteri-ekle";
import { handleMusteriDuzenle, handleMusteriDuzenleCallback, handleMusteriDuzenleStep } from "./musteri-duzenle";
import { handleEslestir, handleEslestirCallback } from "./eslestir";
import { handleHatirlatma, handleHatirlatmaStep, handleHatirlatmaCallback } from "./hatirlatma";
import { handleTakipEt, handleTakipEtStep, handleTakipEtCallback } from "./takip-et";
import { handleSatisTavsiye, handleSatisTavsiyeCallback } from "./satis-tavsiye";
import { handleOrtakPazar, handleOrtakPazarCallback } from "./ortak-pazar";
import { handleFotograf, handleFotografCallback, handlePaylas, handlePaylasCallback, handleYayinla, handleYayinlaCallback, handleWebsitem } from "./medya";
import { handleDegerle, handleDegerleCallback, handleMulkOner, handleMulkOnerStep } from "./degerle";
import { handleTrend } from "./trend";
import { handleHediyeler, handleHediyelerCallback } from "./hediyeler";

export const emlakCommands: TenantCommandRegistry = {
  commands: {
    // Portföy Sorumlusu
    portfoyum: handlePortfoyum,
    portfoy: handlePortfoyum,
    mulkekle: handleMulkEkle,
    mulkdetay: handleMulkDetay,
    mulkduzenle: handleMulkDuzenle,
    mulksil: handleMulkSil,
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

    // Medya Uzmanı
    fotograf: handleFotograf,
    yayinla: handleYayinla,
    paylas: handlePaylas,
    websitem: handleWebsitem,

    // Pazar Analisti
    fiyatsor: handleFiyatSor,
    degerle: handleDegerle,
    mulkoner: handleMulkOner,
    analiz: handleAnaliz,
    rapor: handleRapor,
    trend: handleTrend,

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
    hatirlatma: handleHatirlatmaStep,
    takipEt: handleTakipEtStep,
    mulkoner: handleMulkOnerStep,
    sozlesme: handleSozlesmeStep,
  },
  callbackPrefixes: {
    "mulkekle:": handleMulkEkleCallback,
    "mulkdetay:": handleMulkDetayCallback,
    "mulkduzenle:": handleMulkDuzenleCallback,
    "mulkedit:": handleMulkEditFieldCallback,
    "mulksil:": handleMulkSilCallback,
    "mulksil_ok:": handleMulkSilCallback,
    "mustekle:": handleMusteriEkleCallback,
    "md_select:": handleMusteriDuzenleCallback,
    "md_edit:": handleMusteriDuzenleCallback,
    "esles:": handleEslestirCallback,
    "htrt:": handleHatirlatmaCallback,
    "tkp:": handleTakipEtCallback,
    "st:": handleSatisTavsiyeCallback,
    "op:": handleOrtakPazarCallback,
    "foto_select:": handleFotografCallback,
    "paylas_select:": handlePaylasCallback,
    "pub:": handleYayinlaCallback,
    "dg:": handleDegerleCallback,
    "hdy:": handleHediyelerCallback,
    "szl:": handleSozlesmeCallback,
  },
  aliases: {
    "portföy": "portfoyum",
    "portföyüm": "portfoyum",
    "müşteriler": "musterilerim",
    "müşterilerim": "musterilerim",
    "fiyat": "fiyatsor",
    "değerle": "degerle",
    "sözleşme": "sozlesme",
    "sözleşmelerim": "sozlesmelerim",
    "kontrat": "sozlesme",
    "panel": "webpanel",
    "dashboard": "webpanel",
    "fotoğraf": "fotograf",
  },
};
