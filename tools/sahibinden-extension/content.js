/**
 * Content script — her sahibinden.com sayfasında auto-mount (manifest matches).
 * Sadece background "parse" message'i alınca DOM parse yapar; aksi durumda
 * pasif.
 *
 * Selector mantığı scripts/scrape-v3.mjs extractListings()'den birebir
 * kopya — sahibinden HTML değişirse iki tarafı da güncelle.
 */

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "parse") return;
  (async () => {
    try {
      // 1) Cookie expire / login form — captcha'dan ÖNCE öncelikli
      const loginReason = detectLoginRequired();
      if (loginReason) {
        sendResponse({ loginRequired: true, reason: loginReason, listings: [] });
        return;
      }

      // 2) Captcha / blok kontrolü
      const captcha = detectCaptcha();
      if (captcha) {
        sendResponse({ captcha: true, reason: captcha });
        return;
      }
      const listings = extractListings(msg);
      sendResponse({ captcha: false, listings });
    } catch (err) {
      sendResponse({ error: err.message, listings: [] });
    }
  })();
  return true; // async sendResponse
});

function detectLoginRequired() {
  // 1) URL auth path'e redirect (cookie expire'ın en net sinyali)
  const url = location.href;
  if (/\/giris\b|\/uye-giris\b|\/login\b/i.test(url)) return "auth-url";
  if (/[?&]action=login\b/i.test(url)) return "action-login";

  // 2) Login form DOM marker'ları (URL aynı kalsa bile inline form)
  if (document.querySelector(".login-form, #user-login, .sign-in, form[action*='giris'], form[action*='login']")) {
    return "login-form";
  }

  // 3) Body class fingerprint'i (bazı sayfalar JS render sonrası body'ye class koyar)
  if (document.body?.classList?.contains("login-page")) return "login-page-body";

  return null;
}

function detectCaptcha() {
  // 1) Sahibinden'in sarı temalı error page'i
  if (document.querySelector(".error-page-container")) return "error-page";

  // 2) "Olağan dışı erişim" / "Basılı Tut" press-hold captcha
  const bodyText = (document.body?.innerText || "").toLowerCase();
  if (bodyText.includes("olağan dışı erişim")) return "olagan-disi";
  if (bodyText.includes("basılı tut")) return "press-hold";

  // 3) URL redirect to olağan dışı erişim path'i (login path artık
  // detectLoginRequired tarafından yakalanıyor — burada yok)
  if (location.href.includes("olagan-disi")) return "olagan-disi-url";

  // 4) PerimeterX challenge iframe (varsa)
  if (document.querySelector("iframe[src*='captcha']")) return "captcha-iframe";

  return null;
}

function extractListings(ctx) {
  const propertyType = ctx?.property_type || "";
  const results = [];
  const rows = document.querySelectorAll(".searchResultsItem");

  for (const row of rows) {
    if (row.classList.contains("nativeAd")) continue;
    if (row.classList.contains("searchResultsPromo498")) continue;

    const titleEl = row.querySelector(".classifiedTitle");
    if (!titleEl) continue;

    const linkEl = row.querySelector('a[href*="/ilan/"]');
    const url = linkEl ? linkEl.href : "";
    if (!url) continue;

    const title = titleEl.textContent?.trim() || "";

    const imgEl = row.querySelector("img.searchResultsLargeImg, img.searchResultsSmallImg, img");
    const photo = imgEl ? (imgEl.src || imgEl.dataset?.src || "") : "";

    const allTds = row.querySelectorAll("td");
    const tds = Array.from(allTds).map((td) => ({
      text: td.textContent?.trim() || "",
      class: td.className?.trim() || "",
    }));

    const locTd = row.querySelector(".searchResultsLocationValue");
    const locText = locTd
      ? locTd.innerHTML.replace(/<br\s*\/?>/gi, " / ").replace(/<[^>]*>/g, "").trim()
      : "";

    const parsed = parseRow(tds, propertyType);
    const source_id = extractListingId(url);

    results.push({
      source_id,
      url,
      title,
      photo,
      neighborhood: locText || parsed.mahalle,
      area_m2: parsed.m2,
      rooms: parsed.rooms,
      price: parsed.fiyat,
      date: parsed.tarih,
    });
  }

  return results;
}

// ── parseRow ve helper'ları scrape-v3.mjs'den birebir kopya ─────────────
const ARSA_TYPES = new Set(["arsa"]);
const DEVRE_MULK_TYPES = new Set(["devre_mulk"]);
const OTEL_TYPES = new Set(["otel", "apart_otel", "butik_otel", "pansiyon"]);
const BINA_TYPES = new Set(["bina"]);

function parseRow(tds, propertyType) {
  const n = tds.length;
  const mahalle = "";
  const tarih = tds[n - 3]?.text || "";
  const fiyatIdx = ARSA_TYPES.has(propertyType) ? n - 5 : n - 4;
  const fiyatRaw = tds[fiyatIdx]?.text || "";
  const fiyat = parsePrice(fiyatRaw);

  let m2 = 0;
  let rooms = "";

  if (ARSA_TYPES.has(propertyType)) {
    m2 = parseArea(tds[2]?.text || "");
  } else if (DEVRE_MULK_TYPES.has(propertyType)) {
    rooms = parseRooms(tds[4]?.text || "");
  } else if (BINA_TYPES.has(propertyType)) {
    m2 = parseArea(tds[2]?.text || "");
    rooms = parseRooms(tds[3]?.text || "");
  } else if (OTEL_TYPES.has(propertyType)) {
    rooms = tds[2]?.text?.trim() || "";
  } else {
    m2 = parseArea(tds[2]?.text || "");
    rooms = parseRooms(tds[3]?.text || "");
  }

  return { mahalle, tarih, fiyat, m2, rooms };
}

function parsePrice(text) {
  if (!text) return 0;
  return parseInt(text.replace(/[^\d]/g, ""), 10) || 0;
}

function parseArea(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[^\d.,]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

function parseRooms(text) {
  if (!text) return "";
  const match = text.match(/(\d\+\d|\d\+0|[Ss]t[üu]dyo)/i);
  return match ? match[0] : "";
}

function extractListingId(url) {
  if (!url) return null;
  const m = url.match(/[-/](\d{7,12})(?:\/|$|\?)/);
  return m ? m[1] : null;
}
