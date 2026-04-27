/**
 * Restoran Tenant — Command Registry
 *
 * Phase 1 (skeleton):
 *   • siparis — açık siparişler (read)
 *   • masa — masa durumu (read)
 *   • rezervasyon — bugün+yarın rezervasyon (read)
 *   • stok — kritik stok uyarısı (read)
 *   • menukalemleri — menü görüntüle (read)
 *   • brifing — günlük özet (read)
 *
 * Phase 2 (sonradan): write komutları (sipariş oluştur, masa kapat,
 * rezervasyon ekle, menü düzenle), AI müşteri asistanı, KDS entegrasyon.
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

import { handleSiparis } from "./siparis";
import { handleMasa } from "./masa";
import { handleRezervasyon } from "./rezervasyon";
import { handleStok } from "./stok";
import { handleMenuKalemleri } from "./menu";
import { handleBrifing } from "./brifing";

export const restoranCommands: TenantCommandRegistry = {
  commands: {
    siparis: handleSiparis,
    masa: handleMasa,
    rezervasyon: handleRezervasyon,
    stok: handleStok,
    menukalemleri: handleMenuKalemleri,
    brifing: handleBrifing,
    gunsonu: handleBrifing,
    ozet: handleBrifing,
  },
  stepHandlers: {},
  callbackPrefixes: {},
  aliases: {
    "siparişler": "siparis",
    "siparisler": "siparis",
    "masalar": "masa",
    "rezervasyonlar": "rezervasyon",
    "rezerve": "rezervasyon",
    "rezervasyon ekle": "rezervasyon",
    "yemekler": "menukalemleri",
    "menüm": "menukalemleri",
    "menukart": "menukalemleri",
    "yemek": "menukalemleri",
    "kritikstok": "stok",
    "stok durumu": "stok",
    "gün sonu": "gunsonu",
    "gunsonu raporu": "gunsonu",
  },
};
