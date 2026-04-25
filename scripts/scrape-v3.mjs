#!/usr/bin/env node
/**
 * Sahibinden Scraper V3 — V2 + sahibinden/emlak ofisi ayrimi
 *
 * Usage:
 *   node scripts/scrape-v3.mjs          → Full scrape (76 URL)
 *   node scripts/scrape-v3.mjs --daily  → Sadece yeni ilanlar (?date=1day)
 *   node scripts/scrape-v3.mjs --visible → Tarayiciyi goster
 *   node scripts/scrape-v3.mjs --test   → Ilk 3 URL ile test
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteerExtra.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI FLAGS ──────────────────────────────────────────────────────────────

const isDailyMode = process.argv.includes('--daily');
const daysArg = process.argv.find(a => a.startsWith('--days='));
const daysCount = daysArg ? parseInt(daysArg.split('=')[1], 10) : (isDailyMode ? 1 : 0);
const isDateFiltered = isDailyMode || !!daysArg;
const isTestMode = process.argv.includes('--test');
const headlessMode = process.argv.includes('--visible') ? false : 'new';
const skipArg = process.argv.find(a => a.startsWith('--skip='));
const skipCount = skipArg ? parseInt(skipArg.split('=')[1], 10) : 0;
const takeArg = process.argv.find(a => a.startsWith('--take='));
const takeCount = takeArg ? parseInt(takeArg.split('=')[1], 10) : 0;
const sahibiOnly = process.argv.includes('--sahibi-only');

// ─── BASE URLs (kullanıcı tarafından doğrulanmış 23 URL) ──────────────────
//
// 25 Nisan 2026: kullanıcı sahibinden canlı görüntüsünden bu URL listesini
// verdi. Daha önce ciftlik_evi, kosk, yali, devren, butik_otel, pansiyon
// gibi Bodrum'da neredeyse hiç ilan olmayan kategorilerde sahibinden
// "Benzer ilanlar" başlığıyla Türkiye geneli sızıntı yapıyordu — bu
// kategoriler tamamen kaldırıldı. Sadece kullanıcının doğruladığı
// kategoriler scrape edilir. BODRUM_KEYWORDS filtresi de import sırasında
// ikinci güvenlik ağı.

const BASE_URLS = [
  // Satilik Konut
  { url: 'https://www.sahibinden.com/satilik-daire/mugla-bodrum', listing_type: 'satilik', property_type: 'daire' },
  { url: 'https://www.sahibinden.com/satilik-rezidans/mugla-bodrum', listing_type: 'satilik', property_type: 'rezidans' },
  { url: 'https://www.sahibinden.com/satilik-mustakil-ev/mugla-bodrum', listing_type: 'satilik', property_type: 'mustakil' },
  { url: 'https://www.sahibinden.com/satilik-villa/mugla-bodrum', listing_type: 'satilik', property_type: 'villa' },
  { url: 'https://www.sahibinden.com/satilik-yazlik/mugla-bodrum', listing_type: 'satilik', property_type: 'yazlik' },

  // Kiralik Konut
  { url: 'https://www.sahibinden.com/kiralik-daire/mugla-bodrum', listing_type: 'kiralik', property_type: 'daire' },
  { url: 'https://www.sahibinden.com/kiralik-rezidans/mugla-bodrum', listing_type: 'kiralik', property_type: 'rezidans' },
  { url: 'https://www.sahibinden.com/kiralik-mustakil-ev/mugla-bodrum', listing_type: 'kiralik', property_type: 'mustakil' },
  { url: 'https://www.sahibinden.com/kiralik-villa/mugla-bodrum', listing_type: 'kiralik', property_type: 'villa' },

  // Satilik Isyeri
  { url: 'https://www.sahibinden.com/satilik-is-yeri-buro-ofis/mugla-bodrum', listing_type: 'satilik', property_type: 'buro_ofis' },
  { url: 'https://www.sahibinden.com/satilik-is-yeri-depo-antrepo/mugla-bodrum', listing_type: 'satilik', property_type: 'depo' },
  { url: 'https://www.sahibinden.com/satilik-is-yeri-dukkan-magaza/mugla-bodrum', listing_type: 'satilik', property_type: 'dukkan' },
  { url: 'https://www.sahibinden.com/satilik-is-yeri-komple-bina/mugla-bodrum', listing_type: 'satilik', property_type: 'komple_bina' },

  // Kiralik Isyeri
  { url: 'https://www.sahibinden.com/kiralik-is-yeri-buro-ofis/mugla-bodrum', listing_type: 'kiralik', property_type: 'buro_ofis' },
  { url: 'https://www.sahibinden.com/kiralik-is-yeri-dukkan-magaza/mugla-bodrum', listing_type: 'kiralik', property_type: 'dukkan' },

  // Arsa
  { url: 'https://www.sahibinden.com/satilik-arsa/mugla-bodrum', listing_type: 'satilik', property_type: 'arsa' },
  { url: 'https://www.sahibinden.com/kiralik-arsa/mugla-bodrum', listing_type: 'kiralik', property_type: 'arsa' },

  // Bina
  { url: 'https://www.sahibinden.com/satilik-bina/mugla-bodrum', listing_type: 'satilik', property_type: 'bina' },

  // Devre Mulk
  { url: 'https://www.sahibinden.com/satilik-devre-mulk/mugla-bodrum', listing_type: 'satilik', property_type: 'devre_mulk' },
  { url: 'https://www.sahibinden.com/turistik-gunluk-kiralik-devre-mulk', listing_type: 'kiralik', property_type: 'devre_mulk' },

  // Turistik Tesis
  { url: 'https://www.sahibinden.com/satilik-otel/mugla-bodrum', listing_type: 'satilik', property_type: 'otel' },
  { url: 'https://www.sahibinden.com/kiralik-otel/mugla-bodrum', listing_type: 'kiralik', property_type: 'otel' },
  { url: 'https://www.sahibinden.com/kiralik-apart-otel/mugla-bodrum', listing_type: 'kiralik', property_type: 'apart_otel' },
];

// Her base URL'den 2 URL uret: /sahibinden ve /emlak-ofisinden
// --sahibi-only flag'i varsa sadece sahibi variant'ları kullan (daily lead pipeline için)
const ALL_URLS = sahibiOnly
  ? BASE_URLS.map(entry => ({ ...entry, url: entry.url + '/sahibinden', listed_by: 'sahibi' }))
  : BASE_URLS.flatMap(entry => [
      { ...entry, url: entry.url + '/sahibinden', listed_by: 'sahibi' },
      { ...entry, url: entry.url + '/emlak-ofisinden', listed_by: 'emlakci' },
    ]);

// ─── CONFIG ─────────────────────────────────────────────────────────────────

const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'v3-bodrum.json');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'v3-progress.json');

const DELAY = {
  page: { min: 4000, max: 7000 },
  category: { min: 30000, max: 60000 },
  blocked: { min: 60000, max: 90000 },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

function sleep(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCookies() {
  const cookiePath = path.join(__dirname, 'cookies.json');
  if (!fs.existsSync(cookiePath)) {
    console.error('❌ cookies.json bulunamadi! scripts/cookies.json olustur.');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
  return raw.map(c => ({
    name: c.name, value: c.value,
    domain: c.domain || '.sahibinden.com', path: c.path || '/',
  }));
}

function extractListingId(url) {
  const match = url.match(/[-/](\d{7,12})(?:\/|$|\?)/);
  return match ? match[1] : null;
}

function parsePrice(text) {
  if (!text) return 0;
  return parseInt(text.replace(/[^\d]/g, ''), 10) || 0;
}

function parseArea(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function parseRooms(text) {
  if (!text) return '';
  const match = text.match(/(\d\+\d|\d\+0|[Ss]t[üu]dyo)/i);
  return match ? match[0] : '';
}

function saveJSON(file, data) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function loadJSON(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

// ─── SPECIAL TYPE SETS ──────────────────────────────────────────────────────

const ARSA_TYPES = new Set(['arsa']);
const DEVRE_MULK_TYPES = new Set(['devre_mulk']);
const OTEL_TYPES = new Set(['otel', 'apart_otel', 'butik_otel', 'pansiyon']);
const BINA_TYPES = new Set(['bina']);

// ─── ROW PARSER — SONDAN SAYMA ─────────────────────────────────────────────

function parseRow(tds, propertyType) {
  const n = tds.length;

  const mahalle = '';
  const tarih = tds[n - 3]?.text || '';
  // Arsa listings have an extra "m² Fiyatı" column before date,
  // so total Fiyat is at n-5 instead of n-4.
  const fiyatIdx = ARSA_TYPES.has(propertyType) ? n - 5 : n - 4;
  const fiyatRaw = tds[fiyatIdx]?.text || '';
  const fiyat = parsePrice(fiyatRaw);

  let m2 = 0;
  let rooms = '';

  if (ARSA_TYPES.has(propertyType)) {
    m2 = parseArea(tds[2]?.text || '');
  } else if (DEVRE_MULK_TYPES.has(propertyType)) {
    rooms = parseRooms(tds[4]?.text || '');
  } else if (BINA_TYPES.has(propertyType)) {
    m2 = parseArea(tds[2]?.text || '');
    rooms = parseRooms(tds[3]?.text || '');
  } else if (OTEL_TYPES.has(propertyType)) {
    rooms = tds[2]?.text?.trim() || '';
  } else {
    m2 = parseArea(tds[2]?.text || '');
    rooms = parseRooms(tds[3]?.text || '');
  }

  return { mahalle, tarih, fiyat, m2, rooms };
}

// ─── PAGE EXTRACTOR (runs in browser) ───────────────────────────────────────

function extractListings() {
  const results = [];
  const rows = document.querySelectorAll('.searchResultsItem');

  for (const row of rows) {
    if (row.classList.contains('nativeAd')) continue;
    if (row.classList.contains('searchResultsPromo498')) continue;

    const titleEl = row.querySelector('.classifiedTitle');
    if (!titleEl) continue;

    const linkEl = row.querySelector('a[href*="/ilan/"]');
    const url = linkEl ? linkEl.href : '';
    if (!url) continue;

    const title = titleEl.textContent?.trim() || '';

    // Thumbnail
    const imgEl = row.querySelector('img.searchResultsLargeImg, img.searchResultsSmallImg, img');
    const photo = imgEl ? (imgEl.src || imgEl.dataset?.src || '') : '';

    // All tds
    const allTds = row.querySelectorAll('td');
    const tds = Array.from(allTds).map(td => ({
      text: td.textContent?.trim() || '',
      class: td.className?.trim() || '',
    }));

    // Location td
    const locTd = row.querySelector('.searchResultsLocationValue');
    const locText = locTd ? locTd.innerHTML.replace(/<br\s*\/?>/gi, ' / ').replace(/<[^>]*>/g, '').trim() : '';

    results.push({ url, title, photo, tds, locText });
  }
  return results;
}

// ─── MAIN ───────────────────────────────────────────────────────────────────

async function scrape() {
  const shuffled = [...ALL_URLS].sort(() => Math.random() - 0.5);
  let urls = isTestMode ? shuffled.slice(skipCount, skipCount + 3) : shuffled;
  if (!isTestMode && (skipCount > 0 || takeCount > 0)) {
    const start = skipCount;
    const end = takeCount > 0 ? start + takeCount : ALL_URLS.length;
    const subset = ALL_URLS.slice(start, end);
    urls = subset.sort(() => Math.random() - 0.5);
  }
  const mode = isDailyMode ? 'DAILY' : isTestMode ? 'TEST' : 'FULL';
  console.log(`\n🏠 Scraper V3 [${mode}] — ${urls.length} URL\n`);

  const cookies = loadCookies();
  console.log(`🍪 ${cookies.length} cookie yuklendi`);

  // Always resume from progress — don't reset on date mode.
  // Completed URLs are skipped, only pending ones are scraped.
  const progress = loadJSON(PROGRESS_FILE) || { completedUrls: [], listings: [] };
  const allListings = progress.listings || [];
  const seenIds = new Set(allListings.map(l => l.source_id));
  const completedUrls = new Set(progress.completedUrls || []);

  if (allListings.length > 0) {
    console.log(`📂 Resume: ${allListings.length} ilan${isDailyMode ? '' : `, ${completedUrls.size} URL tamamlanmis`}\n`);
  }

  const browser = await puppeteerExtra.launch({
    headless: headlessMode,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1366,768'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setCookie(...cookies);

  let blocked = false;

  for (let i = 0; i < urls.length; i++) {
    const { url: baseUrl, listing_type, property_type, listed_by } = urls[i];
    const VALID_DATES = { 1: '1day', 3: '3days', 7: '7days', 15: '15days', 30: '30days' };
    const dateValue = VALID_DATES[daysCount] || VALID_DATES[Object.keys(VALID_DATES).map(Number).find(d => d >= daysCount) || 3];
    const categoryUrl = isDateFiltered
      ? baseUrl + (baseUrl.includes('?') ? `&date=${dateValue}` : `?date=${dateValue}`)
      : baseUrl;

    if (completedUrls.has(baseUrl)) {
      console.log(`⏭️  [${i + 1}/${urls.length}] zaten tamamlanmis — ${property_type} (${listed_by})`);
      continue;
    }

    console.log(`\n🔷 [${i + 1}/${urls.length}] ${listing_type}/${property_type} (${listed_by})`);
    console.log(`  🔗 ${categoryUrl}`);

    let pageNum = 0;
    let currentUrl = categoryUrl;
    const beforeCount = allListings.length;

    while (true) {
      pageNum++;
      console.log(`  📄 Sayfa ${pageNum}`);

      try {
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (err) {
        console.error(`  ⚠️ Sayfa yuklenemedi: ${err.message}`);
        break;
      }
      await sleep(2500, 4000);

      // Block/login check
      const pageUrl = page.url();
      if (pageUrl.includes('/giris') || pageUrl.includes('/login')) {
        console.error('  ❌ Giris duvari! Cookie guncelle.');
        blocked = true;
        break;
      }
      if (pageUrl.includes('olagan-disi')) {
        console.error('  ❌ IP engeli! Bekle ve tekrar dene.');
        blocked = true;
        break;
      }

      // Extract raw rows
      const rawListings = await page.evaluate(extractListings);

      if (rawListings.length === 0) {
        console.log('  Sayfada ilan yok — bitis.');
        break;
      }

      let newCount = 0;
      for (const raw of rawListings) {
        const source_id = extractListingId(raw.url);
        if (!source_id || seenIds.has(source_id)) continue;

        const parsed = parseRow(raw.tds, property_type);

        allListings.push({
          source_id,
          source_url: raw.url,
          title: raw.title,
          area_m2: parsed.m2,
          rooms: parsed.rooms,
          price: parsed.fiyat,
          date: parsed.tarih,
          neighborhood: raw.locText || parsed.mahalle,
          photo: raw.photo,
          listing_type,
          property_type,
          listed_by,
        });
        seenIds.add(source_id);
        newCount++;
      }

      console.log(`  +${newCount} yeni (toplam: ${allListings.length})`);

      // Next page
      const nextUrl = await page.evaluate(() => {
        const btn = document.querySelector('a.prevNextBut[title="Sonraki"]') ||
                    document.querySelector('a[title="Sonraki sayfa"]');
        return btn ? btn.href : null;
      });

      if (!nextUrl) {
        console.log('  ✅ Son sayfa.');
        break;
      }

      currentUrl = nextUrl;
      await sleep(DELAY.page.min, DELAY.page.max);
    }

    if (blocked) {
      console.log('  ⏭️ Engel atlaniyor, uzun bekleme sonrasi sonraki kategoriye geciliyor...');
      blocked = false;
      await sleep(DELAY.blocked.min, DELAY.blocked.max);
      continue;
    }

    const added = allListings.length - beforeCount;
    completedUrls.add(baseUrl);
    console.log(`  ✅ +${added} ilan eklendi`);

    // Save after each category
    saveJSON(PROGRESS_FILE, { completedUrls: [...completedUrls], listings: allListings });
    saveJSON(OUTPUT_FILE, allListings);

    // Wait between categories
    if (i < urls.length - 1 && !isTestMode) {
      await sleep(DELAY.category.min, DELAY.category.max);
    }
  }

  await browser.close();

  // Final save
  saveJSON(OUTPUT_FILE, allListings);
  saveJSON(PROGRESS_FILE, { completedUrls: [...completedUrls], listings: allListings });

  // Summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 OZET`);
  console.log(`  Toplam: ${allListings.length} ilan`);
  console.log(`  URL tamamlanan: ${completedUrls.size}/${urls.length}`);

  const byType = {};
  for (const l of allListings) {
    const key = `${l.listing_type}/${l.property_type}/${l.listed_by}`;
    byType[key] = (byType[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${key}: ${count}`);
  }

  const withArea = allListings.filter(l => l.area_m2 > 0).length;
  const withRooms = allListings.filter(l => l.rooms).length;
  const withNeighborhood = allListings.filter(l => l.neighborhood).length;
  console.log(`  m² dolu: ${withArea} (${(withArea / allListings.length * 100).toFixed(1)}%)`);
  console.log(`  Oda dolu: ${withRooms} (${(withRooms / allListings.length * 100).toFixed(1)}%)`);
  console.log(`  Mahalle dolu: ${withNeighborhood} (${(withNeighborhood / allListings.length * 100).toFixed(1)}%)`);

  const bySeller = {};
  for (const l of allListings) {
    bySeller[l.listed_by] = (bySeller[l.listed_by] || 0) + 1;
  }
  console.log(`  Sahibi: ${bySeller['sahibi'] || 0} | Emlakci: ${bySeller['emlakci'] || 0}`);

  console.log(`\n📁 Cikti: ${OUTPUT_FILE}`);
  if (blocked) console.log(`\n⚠️ Engel nedeniyle durdu. Tekrar calistirinca kaldigi yerden devam eder.`);
}

scrape().catch(console.error);
