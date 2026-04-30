/**
 * Otel Tenant — Command Registry
 *
 * 20 real commands across 5 domains:
 *   Genel (4): durum, brifing, rapor, gelir
 *   Rezervasyon (7): rezervasyonlar, rezervasyonekle, rezervasyondetay, checkin, checkout, musaitlik, fiyat
 *   Misafir (4): misafirler, mesajlar, yanitla, yorumlar
 *   Oda (4): odalar, odaguncelle, temizlik, gorevata
 *   Analiz (1): doluluk
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";
import { OTEL_CAPABILITIES as C } from "../capabilities";

// Genel
import { handleDurum } from "./durum";
import { handleBrifing } from "./brifing";
import { handleRapor, handleRaporCallback } from "./rapor";
import { handleGelir } from "./gelir";

// Rezervasyon
import { handleRezervasyonlar } from "./rezervasyonlar";
import { handleRezervasyonEkle, handleRezervasyonEkleStep, handleRezervasyonEkleCallback } from "./rezervasyon-ekle";
import { handleRezervasyonDetay, handleRezervasyonYonetimCallback } from "./rezervasyon-yonetim";
import { handleCheckin, handleCheckout } from "./checkin-checkout";
import { handleMusaitlik, handleFiyat } from "./musaitlik";

// Misafir
import { handleMisafirler, handleMesajlar } from "./misafirler";
import { handleYanitla, handleYanitlaStep, handleYanitlaCallback } from "./yanitla";
import { handleYorumlar, handleYorumlarCallback } from "./yorumlar";

// Oda
import { handleOdalar } from "./odalar";
import { handleOdaGuncelle, handleOdaGuncelleCallback } from "./oda-guncelle";
import { handleTemizlik } from "./temizlik";
import { handleGorevAta, handleGorevAtaStep, handleGorevAtaCallback } from "./gorev-ata";

// Analiz
import { handleDoluluk } from "./doluluk";

// Yönetim — çalışan + duyuru
import {
  handleCalisanEkle, handleCalisanEkleStep, handleCalisanEkleCallback,
  handleCalisanYonet,
  handleDuyuru, handleDuyuruStep,
} from "./calisan";

// Misafir tarafı (role='guest', lifetime)
import {
  handleMisafirDavet, handleMisafirDavetStep,
  handleRezervasyonum, handleRezervasyonlarim,
  handleHizmetler, handleWifi,
  handleTalep, handleTalepStep,
} from "./misafir";

// Online check-in (mekik link)
import { handleCekin, handleCekinLink } from "./cekin";

export const otelCommands: TenantCommandRegistry = {
  commands: {
    // ── Genel ──────────────────────────────────────────
    durum: handleDurum,
    brifing: handleBrifing,
    rapor: handleRapor,
    gelir: handleGelir,

    // ── Rezervasyon ────────────────────────────────────
    rezervasyonlar: handleRezervasyonlar,
    rezervasyonekle: handleRezervasyonEkle,
    rezervasyondetay: handleRezervasyonDetay,
    checkin: handleCheckin,
    checkout: handleCheckout,
    musaitlik: handleMusaitlik,
    fiyat: handleFiyat,

    // ── Misafir ────────────────────────────────────────
    misafirler: handleMisafirler,
    mesajlar: handleMesajlar,
    yanitla: handleYanitla,
    yorumlar: handleYorumlar,

    // ── Oda ────────────────────────────────────────────
    odalar: handleOdalar,
    odaguncelle: handleOdaGuncelle,
    temizlik: handleTemizlik,
    gorevata: handleGorevAta,

    // ── Analiz ─────────────────────────────────────────
    doluluk: handleDoluluk,

    // ── Yönetim (sahip) ────────────────────────────────
    calisanekle: handleCalisanEkle,
    calisanyonet: handleCalisanYonet,
    duyuru: handleDuyuru,

    // ── Misafir davet (resepsiyon+) ────────────────────
    misafirdavet: handleMisafirDavet,

    // ── Misafir komutları (role='guest') ───────────────
    rezervasyonum: handleRezervasyonum,
    rezervasyonlarim: handleRezervasyonlarim,
    hizmetler: handleHizmetler,
    wifi: handleWifi,
    talep: handleTalep,

    // ── Online check-in (mekik) ────────────────────────
    cekin: handleCekin,
    cekinlink: handleCekinLink,
  },

  stepHandlers: {
    rezekle: handleRezervasyonEkleStep,
    yanitla: handleYanitlaStep,
    gorevata: handleGorevAtaStep,
    calisanekle: handleCalisanEkleStep,
    duyuru: handleDuyuruStep,
    misafirdavet: handleMisafirDavetStep,
    talep: handleTalepStep,
  },

  callbackPrefixes: {
    // Rezervasyon ekleme
    "rezekle_room:": handleRezervasyonEkleCallback,
    "rezekle_confirm:": handleRezervasyonEkleCallback,

    // Rezervasyon yönetim
    "rezdetay:": handleRezervasyonYonetimCallback,
    "rezaction:": handleRezervasyonYonetimCallback,

    // Oda güncelleme
    "odagunc_select:": handleOdaGuncelleCallback,
    "odagunc_status:": handleOdaGuncelleCallback,

    // Görev atama
    "gorev_room:": handleGorevAtaCallback,
    "gorev_type:": handleGorevAtaCallback,
    "gorev_pri:": handleGorevAtaCallback,

    // Yanıtla
    "yanitla_select:": handleYanitlaCallback,
    "yanitla_ok:": handleYanitlaCallback,
    "yanitla_cancel:": handleYanitlaCallback,

    // Rapor
    "rapor_period:": handleRaporCallback,

    // Yorumlar
    "yorum_filter:": handleYorumlarCallback,

    // Çalışan ekle (detail/sil)
    "calisanekle:": handleCalisanEkleCallback,
  },

  aliases: {
    // Genel
    "durum": "durum",
    "ozet": "durum",
    "brifing": "brifing",
    "sabah": "brifing",
    "faq": "brifing",
    "rapor": "rapor",
    "gelir": "gelir",
    "ciro": "gelir",

    // Rezervasyon
    "oda": "odalar",
    "rezervasyon": "rezervasyonlar",
    "rezler": "rezervasyonlar",
    "yenirez": "rezervasyonekle",
    "rezekle": "rezervasyonekle",
    "rezdetay": "rezervasyondetay",
    "müsaitlik": "musaitlik",
    "bos": "musaitlik",

    // Misafir
    "müşteriler": "misafirler",
    "misafir": "misafirler",
    "mesaj": "mesajlar",
    "yanit": "yanitla",
    "cevapla": "yanitla",
    "yorum": "yorumlar",
    "puan": "yorumlar",

    // Oda
    "odadurum": "odaguncelle",
    "görevata": "gorevata",
    "gorev": "gorevata",

    // Analiz
    "doluluk": "doluluk",
    "occupancy": "doluluk",

    // Genel
    "yardım": "menu",
    "yardim": "menu",
    "help": "menu",

    // Misafir tarafı (role='guest')
    // "rezervasyon" personel için rezervasyonlar'a map'lendi (line 161),
    // misafir "rezum" veya direkt "rezervasyonum" yazsın.
    "rezum": "rezervasyonum",
    "tarihce": "rezervasyonlarim",
    "rezlerim": "rezervasyonlarim",
    "hizmet": "hizmetler",
    "servisler": "hizmetler",
    "wifi": "wifi",
    "internet": "wifi",
    "talep": "talep",
    "şikayet": "talep",
    "sikayet": "talep",
    "misafirdavet": "misafirdavet",
    "yenirezmisafir": "misafirdavet",

    // Online check-in
    "cekin": "cekin",
    "checkin_online": "cekin",
    "online_checkin": "cekin",
    "cekinlink": "cekinlink",
  },

  // ── Capability requirements ──────────────────────────────────────────
  // Owner wildcard "*" grants everything automatically.
  // Null / omitted = no capability needed (open to anyone with a profile).
  // Array form = OR (user needs at least one of the listed capabilities).
  // See ../capabilities.ts for the registry.
  requiredCapabilities: {
    // ── Genel ──────────────────────────────────────────
    durum: null,
    brifing: C.REPORTS_VIEW,
    rapor: C.REPORTS_VIEW,
    gelir: C.FINANCE_VIEW,

    // ── Rezervasyon ────────────────────────────────────
    rezervasyonlar: C.RESERVATIONS_VIEW,
    rezervasyonekle: C.RESERVATIONS_CREATE,
    rezervasyondetay: C.RESERVATIONS_VIEW,
    checkin: C.RESERVATIONS_CHECKIN,
    checkout: C.RESERVATIONS_CHECKIN,
    musaitlik: C.AVAILABILITY_VIEW,
    fiyat: C.PRICING_VIEW,

    // ── Misafir (personel-tarafı) ──────────────────────
    misafirler: C.GUESTS_VIEW,
    mesajlar: C.GUESTS_MESSAGE,
    yanitla: C.GUESTS_MESSAGE,
    yorumlar: C.GUESTS_REVIEWS,

    // ── Oda ────────────────────────────────────────────
    odalar: C.ROOMS_VIEW,
    odaguncelle: C.ROOMS_STATUS_EDIT,
    temizlik: [C.HOUSEKEEPING_VIEW, C.HOUSEKEEPING_VIEW_OWN],
    gorevata: C.HOUSEKEEPING_ASSIGN,

    // ── Analiz ─────────────────────────────────────────
    doluluk: C.REPORTS_VIEW,

    // ── Yönetim (owner-only komutları wildcard '*' ile geçer) ─────
    calisanekle: C.EMPLOYEES_MANAGE,
    calisanyonet: C.EMPLOYEES_MANAGE,
    duyuru: C.ANNOUNCEMENTS,

    // ── Misafir davet — resepsiyon, müdür, sahip ──────
    misafirdavet: C.GUESTS_INVITE,

    // ── Misafir komutları (lifetime, role='guest') ────
    rezervasyonum: C.RESERVATIONS_VIEW_OWN,
    rezervasyonlarim: C.RESERVATIONS_VIEW_OWN,
    hizmetler: C.GUEST_SERVICES_VIEW,
    wifi: C.GUEST_SERVICES_VIEW,
    talep: C.GUEST_REQUEST_CREATE,

    // ── Online check-in (mekik) ───────────────────────
    // cekin: misafir kendisi açar (GUEST_PRE_CHECKIN_FORM cap = guest preset'inde)
    // cekinlink: resepsiyon push (PRE_CHECKIN_PUSH cap = reception preset'inde)
    cekin: C.GUEST_PRE_CHECKIN_FORM,
    cekinlink: C.PRE_CHECKIN_PUSH,
  },
};
