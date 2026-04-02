/**
 * Muhasebe Tenant — Command Registry
 *
 * 31 commands across 4 virtual employees:
 *   Fatura Isleme Uzmani (7), Sekreter (8), Vergi Uzmani (6), Tahsilat Uzmani (6), Genel (4)
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

// Fatura Isleme Uzmani
import {
  handleFaturaYukle,
  handleSonFaturalar,
  handleFaturaAra,
  stepFaturaAra,
  handleFaturaDetay,
  stepFaturaDetay,
  handleFaturaRapor,
} from "./fatura";

// Sekreter
import {
  handleMukellefler,
  handleMukellefEkle,
  stepMukellefEkle,
  handleTakvim,
  handleYaklasan,
  handleRandevular,
  handleBrifing,
} from "./sekreter";

// Vergi Uzmani
import {
  handleKdv,
  stepKdv,
  handleGelirVergisi,
  stepGelirVergisi,
  handleKurumlar,
  stepKurumlar,
  handleVergiRaporu,
  handleKontrol,
  handleOranlar,
} from "./vergi";

// Tahsilat Uzmani
import {
  handleAlacaklar,
  handleGeciken,
  handleHatirlatmaGonder,
  stepHatirlatmaGonder,
  handleOdemeEkle,
  stepOdemeEkle,
  handleNakitAkis,
  handleRisk,
} from "./tahsilat";

// Additional commands
import {
  handleGiderEkle,
  stepGiderEkle,
  handleDonemOzeti,
  handleBankaMutabakat,
  handleMukellefDetay,
  stepMukellefDetay,
  handleRandevuEkle,
  stepRandevuEkle,
  handleFaturaEkle,
  stepFaturaEkle,
  handleMuhWebpanel,
} from "./ek-komutlar";

export const muhasebeCommands: TenantCommandRegistry = {
  commands: {
    // ── Fatura Isleme Uzmani ──────────────────────────
    fatura_yukle: handleFaturaYukle,
    son_faturalar: handleSonFaturalar,
    fatura_ara: handleFaturaAra,
    fatura_detay: handleFaturaDetay,
    fatura_rapor: handleFaturaRapor,
    fatura_ekle: handleFaturaEkle,

    // ── Sekreter ──────────────────────────────────────
    mukellefler: handleMukellefler,
    mukellef_ekle: handleMukellefEkle,
    mukellef_detay: handleMukellefDetay,
    takvim: handleTakvim,
    yaklasan: handleYaklasan,
    randevular: handleRandevular,
    randevu_ekle: handleRandevuEkle,
    brifing: handleBrifing,

    // ── Vergi Uzmani ──────────────────────────────────
    kdv: handleKdv,
    gelir_vergisi: handleGelirVergisi,
    kurumlar: handleKurumlar,
    vergi_raporu: handleVergiRaporu,
    kontrol: handleKontrol,
    oranlar: handleOranlar,

    // ── Tahsilat Uzmani ───────────────────────────────
    alacaklar: handleAlacaklar,
    geciken: handleGeciken,
    hatirlatma_gonder: handleHatirlatmaGonder,
    odeme_ekle: handleOdemeEkle,
    nakit_akis: handleNakitAkis,
    risk: handleRisk,

    // ── Genel ─────────────────────────────────────────
    gider_ekle: handleGiderEkle,
    donem_ozeti: handleDonemOzeti,
    banka_mutabakat: handleBankaMutabakat,
    webpanel: handleMuhWebpanel,
  },

  stepHandlers: {
    fatura_ara: stepFaturaAra,
    fatura_detay: stepFaturaDetay,
    fatura_ekle: stepFaturaEkle,
    mukellef_ekle: stepMukellefEkle,
    mukellef_detay: stepMukellefDetay,
    randevu_ekle: stepRandevuEkle,
    kdv: stepKdv,
    gelir_vergisi: stepGelirVergisi,
    kurumlar: stepKurumlar,
    hatirlatma_gonder: stepHatirlatmaGonder,
    odeme_ekle: stepOdemeEkle,
    gider_ekle: stepGiderEkle,
  },

  callbackPrefixes: {
    "muh_fatura:": async (ctx, callbackData) => {
      const action = callbackData.replace("muh_fatura:", "");
      if (action === "ara") {
        const { handleFaturaAra: handle } = await import("./fatura");
        await handle(ctx);
      } else if (action === "detay") {
        const { handleFaturaDetay: handle } = await import("./fatura");
        await handle(ctx);
      } else if (action === "ekle") {
        const { handleFaturaEkle: handle } = await import("./ek-komutlar");
        await handle(ctx);
      }
    },
    "muh_mukellef:": async (ctx, callbackData) => {
      const action = callbackData.replace("muh_mukellef:", "");
      if (action === "ekle") {
        const { handleMukellefEkle: handle } = await import("./sekreter");
        await handle(ctx);
      } else if (action === "detay") {
        const { handleMukellefDetay: handle } = await import("./ek-komutlar");
        await handle(ctx);
      }
    },
    "muh_randevu:": async (ctx, callbackData) => {
      const action = callbackData.replace("muh_randevu:", "");
      if (action === "ekle") {
        const { handleRandevuEkle: handle } = await import("./ek-komutlar");
        await handle(ctx);
      }
    },
    "muh_vergi:": async (ctx, callbackData) => {
      const action = callbackData.replace("muh_vergi:", "");
      if (action === "kdv") {
        const { handleKdv: handle } = await import("./vergi");
        await handle(ctx);
      } else if (action === "gelir") {
        const { handleGelirVergisi: handle } = await import("./vergi");
        await handle(ctx);
      } else if (action === "kurumlar") {
        const { handleKurumlar: handle } = await import("./vergi");
        await handle(ctx);
      }
    },
    "muh_tahsilat:": async (ctx, callbackData) => {
      const action = callbackData.replace("muh_tahsilat:", "");
      if (action === "hatirlatma") {
        const { handleHatirlatmaGonder: handle } = await import("./tahsilat");
        await handle(ctx);
      } else if (action === "odeme") {
        const { handleOdemeEkle: handle } = await import("./tahsilat");
        await handle(ctx);
      }
    },
  },

  aliases: {
    // Fatura aliases
    fatura: "son_faturalar",
    faturalar: "son_faturalar",
    "son_fatura": "son_faturalar",
    "fatura_listesi": "son_faturalar",

    // Mukellef aliases
    "mükkellef": "mukellefler",
    "mükellef": "mukellefler",
    mukellef: "mukellefler",
    "müşteri": "mukellefler",
    musteri: "mukellefler",
    "müşteriler": "mukellefler",

    // Calendar aliases
    beyanname: "takvim",
    deadline: "yaklasan",
    "deadlinelar": "yaklasan",
    randevu: "randevular",

    // Tax aliases
    vergi: "oranlar",
    "vergi_oranları": "oranlar",
    "vergi_oranlari": "oranlar",
    "kdv_hesapla": "kdv",
    "gelir_vergisi_hesapla": "gelir_vergisi",
    "kurumlar_vergisi": "kurumlar",

    // Collection aliases
    alacak: "alacaklar",
    tahsilat: "alacaklar",
    odeme: "odeme_ekle",
    "ödeme": "odeme_ekle",
    hatirlatma: "hatirlatma_gonder",
    nakit: "nakit_akis",
    "nakit_akışı": "nakit_akis",

    // New command aliases
    gider: "gider_ekle",
    ozet: "donem_ozeti",
    "dönem_özeti": "donem_ozeti",
    mutabakat: "banka_mutabakat",
    "banka": "banka_mutabakat",
    panel: "webpanel",
    dashboard: "webpanel",
  },
};
