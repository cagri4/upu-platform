/**
 * Muhasebe Tenant — Command Registry
 *
 * 25 commands across 4 virtual employees:
 *   Fatura Isleme Uzmani (5), Sekreter (6), Vergi Uzmani (6), Tahsilat Uzmani (6)
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

export const muhasebeCommands: TenantCommandRegistry = {
  commands: {
    // ── Fatura Isleme Uzmani ──────────────────────────
    fatura_yukle: handleFaturaYukle,
    son_faturalar: handleSonFaturalar,
    fatura_ara: handleFaturaAra,
    fatura_detay: handleFaturaDetay,
    fatura_rapor: handleFaturaRapor,

    // ── Sekreter ──────────────────────────────────────
    mukellefler: handleMukellefler,
    mukellef_ekle: handleMukellefEkle,
    takvim: handleTakvim,
    yaklasan: handleYaklasan,
    randevular: handleRandevular,
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
  },

  stepHandlers: {
    fatura_ara: stepFaturaAra,
    fatura_detay: stepFaturaDetay,
    mukellef_ekle: stepMukellefEkle,
    kdv: stepKdv,
    gelir_vergisi: stepGelirVergisi,
    kurumlar: stepKurumlar,
    hatirlatma_gonder: stepHatirlatmaGonder,
    odeme_ekle: stepOdemeEkle,
  },

  callbackPrefixes: {},

  aliases: {
    fatura: "son_faturalar",
    faturalar: "son_faturalar",
    "mükkellef": "mukellefler",
    "mükellef": "mukellefler",
    mukellef: "mukellefler",
    beyanname: "takvim",
    deadline: "yaklasan",
    randevu: "randevular",
    vergi: "oranlar",
    "vergi_oranları": "oranlar",
    alacak: "alacaklar",
    tahsilat: "alacaklar",
    odeme: "odeme_ekle",
    "ödeme": "odeme_ekle",
    hatirlatma: "hatirlatma_gonder",
    nakit: "nakit_akis",
    "nakit_akışı": "nakit_akis",
  },
};
