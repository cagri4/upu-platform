/**
 * Bayi Tenant — Command Registry
 *
 * 37 commands across 6 departments:
 *   Yonetim (4), Satis (10), Finans (8), Depo (6), Lojistik (3), Urun (4)
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { createPlaceholderHandler } from "@/platform/whatsapp/placeholder";

// Yonetim
import { handleOzet } from "./ozet";
import { handleRapor } from "./rapor";
import { handleTakvim, handleHatirlatma } from "./takvim";

// Satis — Mudur
import { handleKampanyalar, handleKampanyaOlustur, handleTeklifVer, handlePerformans, handleSegment } from "./kampanya";

// Satis — Temsilci
import {
  handleSiparisler,
  handleSiparisOlustur,
  handleSiparisBayiCallback,
  handleSiparisUrunCallback,
  handleSiparisDevamCallback,
  handleSiparisOnayCallback,
  handleSiparisStep,
} from "./siparis";
import { handleBayiDurum, handleZiyaretler, handleZiyaretNotu } from "./bayi-durum";

// Finans — Muhasebeci
import { handleBakiye, handleFaturalar, handleBorcDurum, handleEkstre, handleOdeme } from "./bakiye";

// Finans — Tahsildar
import { handleVadeler, handleTahsilat, handleHatirlatGonder } from "./tahsilat";

// Depo
import { handleStok, handleKritikStok, handleStokHareketleri, handleTedarikciler, handleSatinAlma, handleIhtiyac } from "./stok";

// Lojistik
import { handleTeslimatlar, handleRota, handleKargoTakip } from "./lojistik";

// Urun
import { handleUrunler, handleFiyatListe, handleYeniUrun, handleFiyatGuncelle } from "./urunler";

// Dealer-facing commands
import {
  handleDealerSiparisVer, handleDealerSiparislerim, handleDealerTekrarSiparis,
  handleDealerBakiyem, handleDealerFaturalarim, handleDealerOdemelerim,
  handleDealerUrunler, handleDealerKampanyalar, handleDealerMesajGonder,
  handleDealerMesajStep,
} from "./dealer";

// Calisan management
import {
  handleCalisanEkle, handleCalisanEkleStep, handleCalisanEkleCallback,
  handleCalisanYonet, handleTalimat, handleTalimatCallback, handleTalimatStep,
} from "./calisan";

// Bayi davet
import { handleBayiDavet } from "./bayi-davet";

// Dealer onboarding
import { handleDealerOnboardStep, handleDealerOnboardCallback } from "./dealer-onboarding";

// Bildirim (interactive notifications)
import {
  handleKampanyaBildir, handleKampanyaBildirCallback,
  handleTahsilatBildir, handleTahsilatBildirCallback,
  handleDuyuru, handleDuyuruStep,
} from "./bildirim";

const ph = createPlaceholderHandler("bayi");

export const bayiCommands: TenantCommandRegistry = {
  commands: {
    // ── Yonetim / Asistan ────────────────────────────
    ozet: handleOzet,
    takvim: handleTakvim,
    hatirlatma: handleHatirlatma,
    rapor: handleRapor,

    // ── Satis / Satis Muduru ─────────────────────────
    kampanyaolustur: handleKampanyaOlustur,
    kampanyalar: handleKampanyalar,
    teklifver: handleTeklifVer,
    performans: handlePerformans,
    segment: handleSegment,

    // ── Satis / Satis Temsilcisi ─────────────────────
    siparisolustur: handleSiparisOlustur,
    siparisler: handleSiparisler,
    bayidurum: handleBayiDurum,
    ziyaretnotu: handleZiyaretNotu,
    ziyaretler: handleZiyaretler,

    // ── Finans / Muhasebeci ──────────────────────────
    bakiye: handleBakiye,
    faturalar: handleFaturalar,
    borcdurum: handleBorcDurum,
    ekstre: handleEkstre,
    odeme: handleOdeme,

    // ── Finans / Tahsildar ───────────────────────────
    vadeler: handleVadeler,
    tahsilat: handleTahsilat,
    hatirlatgonder: handleHatirlatGonder,

    // ── Depo / Depocu ────────────────────────────────
    stok: handleStok,
    kritikstok: handleKritikStok,
    stokhareketleri: handleStokHareketleri,
    tedarikciler: handleTedarikciler,
    satinalma: handleSatinAlma,
    ihtiyac: handleIhtiyac,

    // ── Lojistik / Lojistikci ────────────────────────
    teslimatlar: handleTeslimatlar,
    rota: handleRota,
    kargotakip: handleKargoTakip,

    // ── Urun / Urun Yoneticisi ───────────────────────
    urunler: handleUrunler,
    fiyatliste: handleFiyatListe,
    yeniurun: handleYeniUrun,
    fiyatguncelle: handleFiyatGuncelle,

    // ── Ekip Yönetimi ─────────────────────────────────
    calisanekle: handleCalisanEkle,
    calisanyonet: handleCalisanYonet,
    talimat: handleTalimat,

    // ── Bayi Davet ───────────────────────────────────
    bayidavet: handleBayiDavet,

    // ── Bildirim / İletişim ─────────────────────────
    kampanyabildir: handleKampanyaBildir,
    tahsilatbildir: handleTahsilatBildir,
    duyuru: handleDuyuru,

    // ── Dealer commands ─────────────────────────────
    siparisver: handleDealerSiparisVer,
    siparislerim: handleDealerSiparislerim,
    tekrarsiparis: handleDealerTekrarSiparis,
    bakiyem: handleDealerBakiyem,
    faturalarim: handleDealerFaturalarim,
    odemelerim: handleDealerOdemelerim,
    fiyatlar: handleFiyatListe,
    aktifkampanyalar: handleDealerKampanyalar,
    mesajgonder: handleDealerMesajGonder,
  },
  stepHandlers: {
    siparisolustur: handleSiparisStep,
    dealer_mesaj: handleDealerMesajStep,
    calisanekle: handleCalisanEkleStep,
    talimat: handleTalimatStep,
    duyuru: handleDuyuruStep,
    dealer_onboard: handleDealerOnboardStep,
  },
  callbackPrefixes: {
    "siparis_bayi:": handleSiparisBayiCallback,
    "siparis_urun:": handleSiparisUrunCallback,
    "siparis_devam:": handleSiparisDevamCallback,
    "siparis_onay:": handleSiparisOnayCallback,
    "calisanekle:": handleCalisanEkleCallback,
    "talimat_kisi:": handleTalimatCallback,
    "kmp_bildir:": handleKampanyaBildirCallback,
    "tahsilat_gonder:": handleTahsilatBildirCallback,
    "donboard:": handleDealerOnboardCallback,
  },
  aliases: {
    "sipariş": "siparisler",
    "siparislerim": "siparisler",
    "siparis": "siparisler",
    "ürünler": "urunler",
    "urun": "urunler",
    "bayi": "bayidurum",
    "bayiler": "bayidurum",
    "borç": "borcdurum",
    "borc": "borcdurum",
    "kampanya": "kampanyalar",
    "fatura": "faturalar",
    "ziyaret": "ziyaretler",
    "teslimat": "teslimatlar",
    "kargo": "kargotakip",
    "vade": "vadeler",
    "kritik": "kritikstok",
    "fiyat": "fiyatliste",
    "tedarikci": "tedarikciler",
  },
};
