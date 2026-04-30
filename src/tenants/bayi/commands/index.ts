/**
 * Bayi Tenant — Command Registry
 *
 * 37 commands across 6 departments:
 *   Yonetim (4), Satis (10), Finans (8), Depo (6), Lojistik (3), Urun (4)
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { createPlaceholderHandler } from "@/platform/whatsapp/placeholder";
import { BAYI_CAPABILITIES as C } from "../capabilities";
import { withProfileGate as gp, withTierGate as tg } from "./helpers";

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
import { handleUrunler, handleFiyatListe, handleYeniUrun, handleYeniUrunStep, handleYeniUrunCallback, handleFiyatGuncelle } from "./urunler";

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
    kampanyaolustur: gp(handleKampanyaOlustur),
    kampanyalar: handleKampanyalar,
    teklifver: gp(handleTeklifVer),
    performans: handlePerformans,
    segment: handleSegment,

    // ── Satis / Satis Temsilcisi ─────────────────────
    siparisolustur: gp(handleSiparisOlustur),
    siparisler: handleSiparisler,
    bayidurum: handleBayiDurum,
    ziyaretnotu: gp(handleZiyaretNotu),
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
    // hatirlatgonder: AI tahsilat metni Growth+ özellik (ai_dunning_text)
    hatirlatgonder: gp(tg("ai_dunning_text", handleHatirlatGonder)),

    // ── Depo / Depocu ────────────────────────────────
    stok: handleStok,
    kritikstok: handleKritikStok,
    stokhareketleri: handleStokHareketleri,
    tedarikciler: handleTedarikciler,
    satinalma: gp(handleSatinAlma),
    ihtiyac: handleIhtiyac,

    // ── Lojistik / Lojistikci ────────────────────────
    teslimatlar: handleTeslimatlar,
    rota: handleRota,
    kargotakip: handleKargoTakip,

    // ── Urun / Urun Yoneticisi ───────────────────────
    urunler: handleUrunler,
    fiyatliste: handleFiyatListe,
    yeniurun: gp(handleYeniUrun),
    fiyatguncelle: gp(handleFiyatGuncelle),

    // ── Ekip Yönetimi ─────────────────────────────────
    calisanekle: gp(handleCalisanEkle),
    calisanyonet: handleCalisanYonet,
    talimat: gp(handleTalimat),

    // ── Bayi Davet ───────────────────────────────────
    bayidavet: gp(handleBayiDavet),

    // ── Bildirim / İletişim ─────────────────────────
    kampanyabildir: gp(handleKampanyaBildir),
    // tahsilatbildir: SEPA Direct Debit linki Growth+ özellik
    tahsilatbildir: gp(tg("sepa_direct_debit", handleTahsilatBildir)),
    duyuru: gp(handleDuyuru),

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
    yeniurun: handleYeniUrunStep,
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
    "yeniurun_birim:": handleYeniUrunCallback,
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
  // ── Capability requirements (see capabilities.ts) ──────────────────
  // Owner wildcard "*" grants everything automatically, so owners
  // always pass. Null / omitted = no capability needed.
  requiredCapabilities: {
    // Yönetim / Asistan — genel raporlar, takvim, brifing
    ozet: C.REPORTS_VIEW,
    takvim: null,
    hatirlatma: null,
    rapor: C.REPORTS_VIEW,

    // Satış — Müdür
    kampanyaolustur: C.CAMPAIGNS_CREATE,
    kampanyalar: C.CAMPAIGNS_VIEW,
    teklifver: C.CAMPAIGNS_CREATE,
    performans: C.REPORTS_VIEW,
    segment: C.REPORTS_VIEW,

    // Satış — Temsilci
    siparisolustur: C.ORDERS_CREATE,
    siparisler: C.ORDERS_VIEW,
    bayidurum: C.DEALERS_VIEW,
    ziyaretnotu: C.DEALERS_VIEW,
    ziyaretler: C.DEALERS_VIEW,

    // Finans — Muhasebeci
    bakiye: C.FINANCE_BALANCE,
    faturalar: C.FINANCE_INVOICES,
    borcdurum: C.FINANCE_BALANCE,
    ekstre: C.FINANCE_BALANCE,
    odeme: [C.FINANCE_PAYMENTS, C.FINANCE_BALANCE_OWN],

    // Finans — Tahsildar
    vadeler: C.FINANCE_INVOICES,
    tahsilat: C.FINANCE_PAYMENTS,
    hatirlatgonder: C.FINANCE_PAYMENTS,

    // Depo / Depocu
    stok: C.STOCK_VIEW,
    kritikstok: C.STOCK_VIEW,
    stokhareketleri: C.STOCK_VIEW,
    tedarikciler: C.STOCK_PURCHASE,
    satinalma: C.STOCK_PURCHASE,
    ihtiyac: C.STOCK_VIEW,

    // Lojistik
    teslimatlar: C.DELIVERIES_VIEW,
    rota: C.DELIVERIES_ASSIGN,
    kargotakip: C.DELIVERIES_VIEW,

    // Ürün
    urunler: C.PRODUCTS_VIEW,
    fiyatliste: C.PRODUCTS_VIEW,
    yeniurun: C.PRODUCTS_EDIT,
    fiyatguncelle: C.PRODUCTS_EDIT,

    // Ekip yönetimi — owner only (wildcard gives it)
    calisanekle: C.EMPLOYEES_MANAGE,
    calisanyonet: C.EMPLOYEES_MANAGE,
    talimat: C.EMPLOYEES_MANAGE,

    // Bayi davet
    bayidavet: C.DEALERS_INVITE,

    // Bildirim
    kampanyabildir: C.CAMPAIGNS_CREATE,
    tahsilatbildir: C.FINANCE_PAYMENTS,
    duyuru: C.EMPLOYEES_MANAGE,

    // Dealer-facing commands — dealer preset grants the *_OWN variants
    siparisver: C.ORDERS_CREATE,
    siparislerim: [C.ORDERS_VIEW, C.ORDERS_VIEW_OWN],
    tekrarsiparis: C.ORDERS_CREATE,
    bakiyem: [C.FINANCE_BALANCE, C.FINANCE_BALANCE_OWN],
    faturalarim: [C.FINANCE_INVOICES, C.FINANCE_INVOICES_OWN],
    odemelerim: [C.FINANCE_PAYMENTS, C.FINANCE_BALANCE_OWN],
    fiyatlar: C.PRODUCTS_VIEW,
    aktifkampanyalar: C.CAMPAIGNS_VIEW,
    mesajgonder: null,
  },
};
