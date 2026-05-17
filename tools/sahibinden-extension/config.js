/**
 * Extension config — URL listesi (scripts/scrape-v3.mjs'den birebir kopya).
 * 23 Bodrum kategorisi × sadece sahibi (emlakçı atlanır; daily_leads sahibi-only).
 *
 * ESM module — background.js import eder. Content script ayrı (URL'den
 * kategori parse eder, listing_type/property_type background mesajından gelir).
 */

const SAHIBINDEN_URLS = [
  // Satılık Konut
  { url: "https://www.sahibinden.com/satilik-daire/mugla-bodrum",       listing_type: "satilik", property_type: "daire" },
  { url: "https://www.sahibinden.com/satilik-rezidans/mugla-bodrum",    listing_type: "satilik", property_type: "rezidans" },
  { url: "https://www.sahibinden.com/satilik-mustakil-ev/mugla-bodrum", listing_type: "satilik", property_type: "mustakil" },
  { url: "https://www.sahibinden.com/satilik-villa/mugla-bodrum",       listing_type: "satilik", property_type: "villa" },
  { url: "https://www.sahibinden.com/satilik-yazlik/mugla-bodrum",      listing_type: "satilik", property_type: "yazlik" },

  // Kiralık Konut
  { url: "https://www.sahibinden.com/kiralik-daire/mugla-bodrum",       listing_type: "kiralik", property_type: "daire" },
  { url: "https://www.sahibinden.com/kiralik-rezidans/mugla-bodrum",    listing_type: "kiralik", property_type: "rezidans" },
  { url: "https://www.sahibinden.com/kiralik-mustakil-ev/mugla-bodrum", listing_type: "kiralik", property_type: "mustakil" },
  { url: "https://www.sahibinden.com/kiralik-villa/mugla-bodrum",       listing_type: "kiralik", property_type: "villa" },

  // Satılık İşyeri
  { url: "https://www.sahibinden.com/satilik-is-yeri-buro-ofis/mugla-bodrum",      listing_type: "satilik", property_type: "buro_ofis" },
  { url: "https://www.sahibinden.com/satilik-is-yeri-depo-antrepo/mugla-bodrum",   listing_type: "satilik", property_type: "depo" },
  { url: "https://www.sahibinden.com/satilik-is-yeri-dukkan-magaza/mugla-bodrum",  listing_type: "satilik", property_type: "dukkan" },
  { url: "https://www.sahibinden.com/satilik-is-yeri-komple-bina/mugla-bodrum",    listing_type: "satilik", property_type: "komple_bina" },

  // Kiralık İşyeri
  { url: "https://www.sahibinden.com/kiralik-is-yeri-buro-ofis/mugla-bodrum",     listing_type: "kiralik", property_type: "buro_ofis" },
  { url: "https://www.sahibinden.com/kiralik-is-yeri-dukkan-magaza/mugla-bodrum", listing_type: "kiralik", property_type: "dukkan" },

  // Arsa
  { url: "https://www.sahibinden.com/satilik-arsa/mugla-bodrum", listing_type: "satilik", property_type: "arsa" },
  { url: "https://www.sahibinden.com/kiralik-arsa/mugla-bodrum", listing_type: "kiralik", property_type: "arsa" },

  // Bina
  { url: "https://www.sahibinden.com/satilik-bina/mugla-bodrum", listing_type: "satilik", property_type: "bina" },

  // Devre Mülk
  { url: "https://www.sahibinden.com/satilik-devre-mulk/mugla-bodrum",    listing_type: "satilik", property_type: "devre_mulk" },
  { url: "https://www.sahibinden.com/turistik-gunluk-kiralik-devre-mulk", listing_type: "kiralik", property_type: "devre_mulk" },

  // Turistik Tesis
  { url: "https://www.sahibinden.com/satilik-otel/mugla-bodrum",       listing_type: "satilik", property_type: "otel" },
  { url: "https://www.sahibinden.com/kiralik-otel/mugla-bodrum",       listing_type: "kiralik", property_type: "otel" },
  { url: "https://www.sahibinden.com/kiralik-apart-otel/mugla-bodrum", listing_type: "kiralik", property_type: "apart_otel" },
];

// Her base URL'e /sahibinden + ?date=1day eklenir (daily leads pipeline)
export const SAHIBINDEN_TARGETS = SAHIBINDEN_URLS.map((entry) => {
  const sahibiUrl = entry.url + "/sahibinden";
  const dated = sahibiUrl + (sahibiUrl.includes("?") ? "&" : "?") + "date=1day";
  return { ...entry, url: dated, listed_by: "sahibi" };
});

export const BRIDGE_HTTP = "http://127.0.0.1:3001";
export const BRIDGE_WS = "ws://127.0.0.1:3001/ws";

export const TAB_TIMEOUT_MS = 60_000;       // Sayfa render + scrape için
export const TAB_INTERVAL_MS = 60_000;      // Kategoriler arası bekleme (insan trafiği)
export const CONTENT_DOM_WAIT_MS = 3_000;   // DOMContentLoaded sonrası JS render
