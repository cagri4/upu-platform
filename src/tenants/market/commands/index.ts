/**
 * Market Tenant — Command Registry
 *
 * 30 commands across 3 departments:
 *   Stok Sorumlusu (8), Siparis Yoneticisi (11), Finans Analisti (11)
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

// Stok
import { handleStokEkle, stepStokEkle, handleStokGuncelle, stepStokGuncelle, handleStokSil, stepStokSil, handleStokSorgula, handleUnitCallback } from "./stok";

// Siparis
import {
  handleTedarikciEkle, stepTedarikciEkle,
  handleTedarikciler,
  handleSiparisOlustur, stepSiparisOlustur,
  handleSiparisEkle, stepSiparisEkle,
  handleSiparisler,
  handleSiparisDetay, stepSiparisDetay,
  handleSiparisOnayla, stepSiparisOnayla,
  handleSiparisIptal, stepSiparisIptal,
} from "./siparis";

// Fiyat
import { handleFiyatGuncelle, stepFiyatGuncelle, handleFiyatKampanya, stepFiyatKampanya, handleFiyatSorgula, stepFiyatSorgula } from "./fiyat";

// Rapor
import { handleSatisKaydet, stepSatisKaydet, handleRaporGunluk, handleRaporHaftalik, handleTopSatan } from "./rapor";

// Brifing
import { handleBrifing } from "./brifing";

// SKT
import { handleSktKontrol, handleSktEkle, stepSktEkle } from "./skt";

// Kategori
import { handleKategoriler, handleKategoriEkle, stepKategoriEkle, handleCategoryCallback } from "./kategori";

// Kasa & Aylik Rapor
import { handleKasaRapor, handleRaporAylik } from "./kasa";

// Teslimat
import { handleTeslimAl, stepTeslimAl, handleTeslimatlar } from "./teslimat";

export const marketCommands: TenantCommandRegistry = {
  commands: {
    // ── Stok / Stok Sorumlusu ──────────────────────────
    stokekle: handleStokEkle,
    stokguncelle: handleStokGuncelle,
    stoksil: handleStokSil,
    stoksorgula: handleStokSorgula,
    sktkontrol: handleSktKontrol,
    sktekle: handleSktEkle,
    kategoriler: handleKategoriler,
    kategoriekle: handleKategoriEkle,

    // ── Siparis / Siparis Yoneticisi ────────────────────
    tedarikciekle: handleTedarikciEkle,
    tedarikciler: handleTedarikciler,
    siparisolustur: handleSiparisOlustur,
    siparisekle: handleSiparisEkle,
    siparisler: handleSiparisler,
    siparisdetay: handleSiparisDetay,
    siparisonayla: handleSiparisOnayla,
    siparisiptal: handleSiparisIptal,
    teslimal: handleTeslimAl,
    teslimatlar: handleTeslimatlar,

    // ── Fiyat / Finans Analisti ─────────────────────────
    fiyatguncelle: handleFiyatGuncelle,
    fiyatkampanya: handleFiyatKampanya,
    fiyatsorgula: handleFiyatSorgula,

    // ── Rapor / Finans Analisti ─────────────────────────
    satiskaydet: handleSatisKaydet,
    raporgunluk: handleRaporGunluk,
    raporhaftalik: handleRaporHaftalik,
    raporaylik: handleRaporAylik,
    topsatan: handleTopSatan,
    kasarapor: handleKasaRapor,

    // ── Genel ──────────────────────────────────────────
    brifing: handleBrifing,
  },

  stepHandlers: {
    stokekle: stepStokEkle,
    stokguncelle: stepStokGuncelle,
    stoksil: stepStokSil,
    tedarikciekle: stepTedarikciEkle,
    siparisolustur: stepSiparisOlustur,
    siparisekle: stepSiparisEkle,
    siparisdetay: stepSiparisDetay,
    siparisonayla: stepSiparisOnayla,
    siparisiptal: stepSiparisIptal,
    fiyatguncelle: stepFiyatGuncelle,
    fiyatkampanya: stepFiyatKampanya,
    fiyatsorgula: stepFiyatSorgula,
    satiskaydet: stepSatisKaydet,
    sktekle: stepSktEkle,
    kategoriekle: stepKategoriEkle,
    teslimal: stepTeslimAl,
  },

  callbackPrefixes: {
    "mkt_unit:": handleUnitCallback,
    "mkt_cat:": handleCategoryCallback,
  },

  aliases: {
    "stok": "stoksorgula",
    "urunler": "stoksorgula",
    "urun": "stoksorgula",
    "siparis": "siparisler",
    "siparislerim": "siparisler",
    "tedarikci": "tedarikciler",
    "fiyat": "fiyatsorgula",
    "rapor": "raporgunluk",
    "satis": "satiskaydet",
    "kampanya": "fiyatkampanya",
    "gunluk": "raporgunluk",
    "haftalik": "raporhaftalik",
    "aylik": "raporaylik",
    "skt": "sktkontrol",
    "sonkullanma": "sktkontrol",
    "kategori": "kategoriler",
    "kasa": "kasarapor",
    "teslim": "teslimal",
    "ozet": "brifing",
  },
};
