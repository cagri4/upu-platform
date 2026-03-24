/**
 * Otel Tenant — Command Registry
 *
 * 9 real commands across 4 domains:
 *   Genel (2): durum, brifing
 *   Rezervasyon (4): rezervasyonlar, checkin, checkout, musaitlik, fiyat
 *   Misafir (2): misafirler, mesajlar
 *   Oda (2): odalar, temizlik
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

// Genel
import { handleDurum } from "./durum";
import { handleBrifing } from "./brifing";

// Rezervasyon
import { handleRezervasyonlar } from "./rezervasyonlar";
import { handleCheckin, handleCheckout } from "./checkin-checkout";
import { handleMusaitlik, handleFiyat } from "./musaitlik";

// Misafir
import { handleMisafirler, handleMesajlar } from "./misafirler";

// Oda
import { handleOdalar } from "./odalar";
import { handleTemizlik } from "./temizlik";

export const otelCommands: TenantCommandRegistry = {
  commands: {
    // ── Genel ──────────────────────────────────────────
    durum: handleDurum,
    brifing: handleBrifing,

    // ── Rezervasyon ────────────────────────────────────
    rezervasyonlar: handleRezervasyonlar,
    checkin: handleCheckin,
    checkout: handleCheckout,
    musaitlik: handleMusaitlik,
    fiyat: handleFiyat,

    // ── Misafir ────────────────────────────────────────
    misafirler: handleMisafirler,
    mesajlar: handleMesajlar,

    // ── Oda ────────────────────────────────────────────
    odalar: handleOdalar,
    temizlik: handleTemizlik,
  },
  stepHandlers: {},
  callbackPrefixes: {},
  aliases: {
    "oda": "odalar",
    "rezervasyon": "rezervasyonlar",
    "müsaitlik": "musaitlik",
    "müşteriler": "misafirler",
    "misafir": "misafirler",
    "mesaj": "mesajlar",
    "görevata": "temizlik",
    "faq": "brifing",
    "yardım": "menu",
    "yardim": "menu",
    "help": "menu",
  },
};
