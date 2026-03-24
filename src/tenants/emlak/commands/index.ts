/**
 * Emlak Tenant — Command Registry
 *
 * All emlak-specific WhatsApp commands are registered here.
 * Each command handler lives in its own file.
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { handlePortfoyum } from "./portfoyum";
import { handleMulkEkle, handleMulkEkleStep, handleMulkEkleCallback } from "./mulk-ekle";
import { handleFiyatSor } from "./fiyat-sor";
import { handleBrifing } from "./brifing";
import { handleMusteriler } from "./musteriler";

export const emlakCommands: TenantCommandRegistry = {
  commands: {
    portfoyum: handlePortfoyum,
    portfoy: handlePortfoyum,
    mulkekle: handleMulkEkle,
    fiyatsor: handleFiyatSor,
    brifing: handleBrifing,
    musterilerim: handleMusteriler,
    // TODO: taşınacak diğer komutlar
    // mulkdetay, mulkduzenle, mulksil, tara, ekle
    // musteriEkle, musteriDuzenle, eslestir, hatirlatma
    // fotograf, paylas, yayinla, websitem
    // degerle, mulkoner, analiz, rapor, trend
    // satistavsiye, takipEt, ortakpazar
    // gorevler, hediyeler, sozlesme, sozlesmelerim, webpanel
  },
  stepHandlers: {
    mulkekle: handleMulkEkleStep,
  },
  callbackPrefixes: {
    "mulkekle:": handleMulkEkleCallback,
  },
  aliases: {
    "portföy": "portfoyum",
    "portföyüm": "portfoyum",
    "müşteriler": "musterilerim",
    "müşterilerim": "musterilerim",
    "fiyat": "fiyatsor",
    "değerle": "degerle",
  },
};
