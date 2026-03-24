/**
 * Emlak Tenant — Command Registry
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { createPlaceholderHandler } from "@/platform/whatsapp/placeholder";
import { handlePortfoyum } from "./portfoyum";
import { handleMulkEkle, handleMulkEkleStep, handleMulkEkleCallback } from "./mulk-ekle";
import { handleFiyatSor } from "./fiyat-sor";
import { handleBrifing } from "./brifing";
import { handleMusteriler } from "./musteriler";
import { handleGorevler } from "./gorevler";
import { handleSozlesmelerim, handleWebpanel } from "./sozlesme";
import { handleAnaliz, handleRapor, handleTrend } from "./analiz";

const ph = createPlaceholderHandler("emlak");

export const emlakCommands: TenantCommandRegistry = {
  commands: {
    // Portföy Sorumlusu
    portfoyum: handlePortfoyum,
    portfoy: handlePortfoyum,
    mulkekle: handleMulkEkle,
    mulkdetay: ph("mulkdetay", "Portföy Sorumlusu", "Mülk detayı"),
    mulkduzenle: ph("mulkduzenle", "Portföy Sorumlusu", "Mülk düzenle"),
    mulksil: ph("mulksil", "Portföy Sorumlusu", "Mülk sil"),
    tara: ph("tara", "Portföy Sorumlusu", "Sahibinden'den otomatik ekle"),
    ekle: ph("ekle", "Portföy Sorumlusu", "Hızlı mülk ekle"),

    // Satış Destek
    musterilerim: handleMusteriler,
    musteriEkle: ph("musteriEkle", "Satış Destek", "Müşteri ekle"),
    musteriDuzenle: ph("musteriDuzenle", "Satış Destek", "Müşteri düzenle"),
    eslestir: ph("eslestir", "Satış Destek", "Otomatik eşleştirme"),
    hatirlatma: ph("hatirlatma", "Satış Destek", "Hatırlatma kur"),
    takipEt: ph("takipEt", "Satış Destek", "Piyasa takibi"),
    satistavsiye: ph("satistavsiye", "Satış Destek", "Satış tavsiyesi"),
    ortakpazar: ph("ortakpazar", "Satış Destek", "Ortak pazar"),

    // Medya Uzmanı
    fotograf: ph("fotograf", "Medya Uzmanı", "Fotoğraf yükle"),
    yayinla: ph("yayinla", "Medya Uzmanı", "Portale yayınla"),
    paylas: ph("paylas", "Medya Uzmanı", "Sosyal medya paylaşımı"),
    websitem: ph("websitem", "Medya Uzmanı", "Kişisel web sitesi"),

    // Pazar Analisti
    fiyatsor: handleFiyatSor,
    degerle: ph("degerle", "Pazar Analisti", "Mülk değerleme"),
    mulkoner: ph("mulkoner", "Pazar Analisti", "Mülk önerisi"),
    analiz: handleAnaliz,
    rapor: handleRapor,
    trend: handleTrend,

    // Sekreter
    brifing: handleBrifing,
    gorevler: handleGorevler,
    sozlesme: ph("sozlesme", "Sekreter", "Yetkilendirme sözleşmesi"),
    sozlesmelerim: handleSozlesmelerim,
    hediyeler: ph("hediyeler", "Sekreter", "Hediyeler & Kampanya"),
    webpanel: handleWebpanel,
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
    "sözleşme": "sozlesme",
    "sözleşmelerim": "sozlesmelerim",
    "kontrat": "sozlesme",
    "panel": "webpanel",
    "dashboard": "webpanel",
    "fotoğraf": "fotograf",
  },
};
