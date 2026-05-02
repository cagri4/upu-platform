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
import { RESTORAN_CAPABILITIES as C } from "../capabilities";

import { handleSiparis } from "./siparis";
import { handleMasa } from "./masa";
import { handleRezervasyon } from "./rezervasyon";
import { handleRezervasyonEkle, handleRezervasyonEkleStep, handleRezervasyonEkleCallback } from "./rezervasyon-ekle";
import { handleStok } from "./stok";
import { handleMenuKalemleri } from "./menu";
import { handleBrifing } from "./brifing";
import {
  handleSadakat, handleSadakatList, handleUyeOl, handleUyeOlStep, handleUyeOlCallback,
  handlePuanim,
} from "./sadakat";

export const restoranCommands: TenantCommandRegistry = {
  commands: {
    // Sahip / personel
    siparis: handleSiparis,
    masa: handleMasa,
    rezervasyon: handleRezervasyon,
    rezervasyonekle: handleRezervasyonEkle,
    stok: handleStok,
    menukalemleri: handleMenuKalemleri,
    brifing: handleBrifing,
    gunsonu: handleBrifing,
    ozet: handleBrifing,
    // Sadakat (sahip için liste, müşteri için kişisel)
    sadakat: handleSadakat,
    sadakatlist: handleSadakatList,
    uyeol: handleUyeOl,
    puanim: handlePuanim,
  },
  stepHandlers: {
    rezervasyonekle: handleRezervasyonEkleStep,
    uyeol: handleUyeOlStep,
  },
  callbackPrefixes: {
    "rez:":   handleRezervasyonEkleCallback,
    "uyeol:": handleUyeOlCallback,
  },
  aliases: {
    "siparişler": "siparis",
    "siparisler": "siparis",
    "masalar": "masa",
    "rezervasyonlar": "rezervasyon",
    "rezerve": "rezervasyon",
    "yeni rezervasyon": "rezervasyonekle",
    "rezervasyon ekle": "rezervasyonekle",
    "yemekler": "menukalemleri",
    "menüm": "menukalemleri",
    "menukart": "menukalemleri",
    "yemek": "menukalemleri",
    "menu": "menukalemleri",
    "kritikstok": "stok",
    "stok durumu": "stok",
    "gün sonu": "gunsonu",
    "gunsonu raporu": "gunsonu",
    "müdavim": "sadakat",
    "müdavimler": "sadakat",
    "mudavim": "sadakat",
    "mudavimler": "sadakat",
    "uye ol": "uyeol",
    "üye ol": "uyeol",
    "kayit": "uyeol",
    "puanım": "puanim",
  },
  requiredCapabilities: {
    // Sahip wildcard "*" hepsini geçer
    siparis: C.ORDERS_VIEW,
    masa: C.ORDERS_VIEW,
    rezervasyon: C.RESERVATIONS_VIEW,
    rezervasyonekle: C.RESERVATIONS_MANAGE,
    stok: C.INVENTORY_VIEW,
    menukalemleri: C.MENU_VIEW,
    brifing: C.REPORTS_VIEW,
    gunsonu: C.REPORTS_VIEW,
    ozet: C.REPORTS_VIEW,
    sadakat: C.LOYALTY_VIEW,
    sadakatlist: C.LOYALTY_VIEW,
    // uyeol + puanim: müşteri/loyalty member tarafı — capability yok
    uyeol: null,
    puanim: null,
  },
};
