/**
 * Site Yonetim Tenant — Command Registry
 *
 * Ported from site-yonetim-ai WhatsApp commands:
 *   Muhasebeci (4): borcum, rapor, aidat, gelir_gider
 *   Sekreter (3): duyuru, toplanti, mesaj
 *   Teknisyen (3): ariza, bakim, durum
 *   Hukuk Musaviri (2): hukuk, mevzuat
 *   + kayit, binakodu (utility)
 */

import type { TenantCommandRegistry } from "@/platform/whatsapp/types";

// Muhasebeci
import { handleBorcum } from "./borcum";
import { handleRapor } from "./rapor";
import { handleAidat, handleGelirGider } from "./aidat";

// Sekreter
import { handleDuyuru } from "./duyuru";
import { handleToplanti, handleMesaj } from "./durum";

// Teknisyen
import { handleAriza, handleArizaCategoryCallback, handleArizaPriorityCallback, handleArizaStep } from "./ariza";
import { handleBakim, handleDurum } from "./durum";
import { handleHukuk, handleMevzuat } from "./durum";

// Utility
import { handleKayit } from "./kayit";
import { handleBinaKodu } from "./binakodu";

export const siteyonetimCommands: TenantCommandRegistry = {
  commands: {
    // -- Muhasebeci ----------------------------------------
    borcum: handleBorcum,
    rapor: handleRapor,
    aidat: handleAidat,
    gelir_gider: handleGelirGider,

    // -- Sekreter ------------------------------------------
    duyuru: handleDuyuru,
    toplanti: handleToplanti,
    mesaj: handleMesaj,

    // -- Teknisyen -----------------------------------------
    ariza: handleAriza,
    bakim: handleBakim,
    durum: handleDurum,

    // -- Hukuk Musaviri ------------------------------------
    hukuk: handleHukuk,
    mevzuat: handleMevzuat,

    // -- Utility -------------------------------------------
    kayit: handleKayit,
    binakodu: handleBinaKodu,
  },
  stepHandlers: {
    ariza: handleArizaStep,
  },
  callbackPrefixes: {
    "ariza_cat:": handleArizaCategoryCallback,
    "ariza_pri:": handleArizaPriorityCallback,
  },
  aliases: {
    "borc": "borcum",
    "borcum": "borcum",
    "aidata": "aidat",
    "gelir": "gelir_gider",
    "gider": "gelir_gider",
    "arizabildir": "ariza",
    "bina_kodu": "binakodu",
    "start": "kayit",
  },
};
