/**
 * Market Tenant — Command Registry
 *
 * 16 commands across 3 departments:
 *   Stok Sorumlusu (4), Siparis Yoneticisi (8), Finans Analisti (4)
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

export const marketCommands: TenantCommandRegistry = {
  commands: {
    // ── Stok / Stok Sorumlusu ──────────────────────────
    stokekle: handleStokEkle,
    stokguncelle: handleStokGuncelle,
    stoksil: handleStokSil,
    stoksorgula: handleStokSorgula,

    // ── Siparis / Siparis Yoneticisi ────────────────────
    tedarikciekle: handleTedarikciEkle,
    tedarikciler: handleTedarikciler,
    siparisolustur: handleSiparisOlustur,
    siparisekle: handleSiparisEkle,
    siparisler: handleSiparisler,
    siparisdetay: handleSiparisDetay,
    siparisonayla: handleSiparisOnayla,
    siparisiptal: handleSiparisIptal,

    // ── Fiyat / Finans Analisti ─────────────────────────
    fiyatguncelle: handleFiyatGuncelle,
    fiyatkampanya: handleFiyatKampanya,
    fiyatsorgula: handleFiyatSorgula,

    // ── Rapor / Finans Analisti ─────────────────────────
    satiskaydet: handleSatisKaydet,
    raporgunluk: handleRaporGunluk,
    raporhaftalik: handleRaporHaftalik,
    topsatan: handleTopSatan,
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
  },

  callbackPrefixes: {
    "mkt_unit:": handleUnitCallback,
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
  },
};
