#!/usr/bin/env node
/**
 * Retry scrape — sadece belirtilen kategorileri tarar.
 * Usage: node scripts/scrape-retry.mjs
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteerExtra.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sadece başarısız olan 5 URL
const RETRY_URLS = [
  { url: 'https://www.sahibinden.com/satilik-arsa/mugla-bodrum', listing_type: 'satilik', property_type: 'arsa' },
  { url: 'https://www.sahibinden.com/satilik-yazlik/mugla-bodrum', listing_type: 'satilik', property_type: 'yazlik' },
  { url: 'https://www.sahibinden.com/kiralik-yali-dairesi/mugla-bodrum', listing_type: 'kiralik', property_type: 'yali_dairesi' },
  { url: 'https://www.sahibinden.com/kiralik-mustakil-ev/mugla-bodrum', listing_type: 'kiralik', property_type: 'mustakil' },
  { url: 'https://www.sahibinden.com/satilik-villa/mugla-bodrum', listing_type: 'satilik', property_type: 'villa' },
];

const OUTPUT_FILE = path.join(__dirname, 'output', 'v2-retry.json');

function sleep(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadCookies() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'cookies.json'), 'utf-8'));
  return raw.map(c => ({ name: c.name, value: c.value, domain: c.domain || '.sahibinden.com', path: c.path || '/' }));
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
  return parseFloat(text.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
}

function parseRooms(text) {
  if (!text) return '';
  const match = text.match(/(\d\+\d|\d\+0|[Ss]t[üu]dyo)/i);
  return match ? match[0] : '';
}

function extractListings() {
  const results = [];
  const rows = document.querySelectorAll('.searchResultsItem');
  for (const row of rows) {
    if (row.classList.contains('nativeAd') || row.classList.contains('searchResultsPromo498')) continue;
    const titleEl = row.querySelector('.classifiedTitle');
    if (!titleEl) continue;
    const linkEl = row.querySelector('a[href*="/ilan/"]');
    const url = linkEl ? linkEl.href : '';
    if (!url) continue;
    const title = titleEl.textContent?.trim() || '';
    const imgEl = row.querySelector('img.searchResultsLargeImg, img.searchResultsSmallImg, img');
    const photo = imgEl ? (imgEl.src || imgEl.dataset?.src || '') : '';
    const allTds = row.querySelectorAll('td');
    const tds = Array.from(allTds).map(td => ({ text: td.textContent?.trim() || '', class: td.className?.trim() || '' }));
    const locTd = row.querySelector('.searchResultsLocationValue');
    const locText = locTd ? locTd.innerHTML.replace(/<br\s*\/?>/gi, ' / ').replace(/<[^>]*>/g, '').trim() : '';
    results.push({ url, title, photo, tds, locText });
  }
  return results;
}

async function scrape() {
  console.log(`\n🔄 Retry Scrape — ${RETRY_URLS.length} URL\n`);

  const cookies = loadCookies();
  console.log(`🍪 ${cookies.length} cookie yüklendi`);

  const allListings = [];
  const seenIds = new Set();

  const browser = await puppeteerExtra.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--window-size=1366,768'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setCookie(...cookies);

  for (let i = 0; i < RETRY_URLS.length; i++) {
    const { url: baseUrl, listing_type, property_type } = RETRY_URLS[i];
    const categoryUrl = baseUrl + '?date=7days';

    console.log(`\n🔷 [${i + 1}/${RETRY_URLS.length}] ${listing_type}/${property_type}`);

    let pageNum = 0;
    let currentUrl = categoryUrl;
    let blocked = false;

    while (true) {
      pageNum++;
      console.log(`  📄 Sayfa ${pageNum}`);

      try {
        await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (err) {
        console.error(`  ⚠️ Sayfa yüklenemedi: ${err.message}`);
        break;
      }
      await sleep(3000, 5000);

      const pageUrl = page.url();
      if (pageUrl.includes('/giris') || pageUrl.includes('/login')) {
        console.error('  ❌ Giriş duvarı!');
        blocked = true;
        break;
      }
      if (pageUrl.includes('olagan-disi')) {
        console.error('  ❌ IP engeli!');
        blocked = true;
        break;
      }

      const rawListings = await page.evaluate(extractListings);
      if (rawListings.length === 0) { console.log('  Sayfada ilan yok — bitiş.'); break; }

      let newCount = 0;
      const ARSA = new Set(['arsa']);
      for (const raw of rawListings) {
        const source_id = extractListingId(raw.url);
        if (!source_id || seenIds.has(source_id)) continue;
        const tds = raw.tds;
        const n = tds.length;
        const fiyat = parsePrice(tds[n - 4]?.text || '');
        const m2 = ARSA.has(property_type) ? parseArea(tds[2]?.text || '') : parseArea(tds[2]?.text || '');
        const rooms = ARSA.has(property_type) ? '' : parseRooms(tds[3]?.text || '');

        allListings.push({
          source_id, source_url: raw.url, title: raw.title,
          area_m2: m2, rooms, price: fiyat, date: tds[n - 3]?.text || '',
          neighborhood: raw.locText, photo: raw.photo, listing_type, property_type,
        });
        seenIds.add(source_id);
        newCount++;
      }
      console.log(`  +${newCount} yeni (toplam: ${allListings.length})`);

      const nextUrl = await page.evaluate(() => {
        const btn = document.querySelector('a.prevNextBut[title="Sonraki"]') || document.querySelector('a[title="Sonraki sayfa"]');
        return btn ? btn.href : null;
      });
      if (!nextUrl) { console.log('  ✅ Son sayfa.'); break; }
      currentUrl = nextUrl;
      await sleep(4000, 7000);
    }

    if (blocked) {
      console.log('  ⏭️ Engel — 90sn bekleyip devam...');
      await sleep(90000, 120000);
      continue;
    }

    console.log(`  ✅ Tamamlandı`);
    // Kategoriler arası bekleme
    if (i < RETRY_URLS.length - 1) await sleep(30000, 60000);
  }

  await browser.close();

  // Save
  if (!fs.existsSync(path.join(__dirname, 'output'))) fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allListings, null, 2), 'utf-8');

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 RETRY ÖZET: ${allListings.length} yeni ilan`);
  console.log(`📁 Çıktı: ${OUTPUT_FILE}`);
}

scrape().catch(console.error);
