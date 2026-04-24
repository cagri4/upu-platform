#!/usr/bin/env node
/**
 * Daily Leads — Phone Enrichment
 *
 * Her gün scraper + import sonrası çalışır. emlak_daily_leads tablosunda
 * bugünün snapshot'ındaki ve owner_phone henüz dolmamış ilanların detay
 * sayfasına girer, telefon + sahibin adını çeker, DB'ye yazar.
 *
 * Rate-limited: her detay arası 3-5sn bekler.
 *
 * Kullanım:
 *   node scripts/enrich-phones.mjs                      → Bugünün snapshot'ı, limitsiz
 *   node scripts/enrich-phones.mjs --snapshot=2026-04-24
 *   node scripts/enrich-phones.mjs --limit=50
 */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

puppeteerExtra.use(StealthPlugin());
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

const snapshotArg = process.argv.find(a => a.startsWith('--snapshot='));
const snapshotDate = snapshotArg ? snapshotArg.split('=')[1] : new Date().toISOString().slice(0, 10);
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 500;

const sleep = (min, max) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function extractFromPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500, 2500);
    if (page.url().includes('/giris') || page.url().includes('olagan-disi')) {
      return { blocked: true };
    }
    return await page.evaluate(() => {
      const phoneEls = document.querySelectorAll('.pretty-phone-part [data-content]');
      const phones = Array.from(phoneEls).map(el => el.getAttribute('data-content')).filter(Boolean);
      const nameEl = document.querySelector('.storeUserName, .username-info-area h3, .userInfo h3, [class*="userName"]');
      return { phone: phones[0] || null, ownerName: nameEl ? nameEl.innerText.trim() : null };
    });
  } catch (err) {
    return { error: err.message };
  }
}

async function main() {
  console.log(`📸 Snapshot: ${snapshotDate}`);

  const { data: rows, error } = await sb
    .from('emlak_daily_leads')
    .select('id, source_url, source_id')
    .eq('snapshot_date', snapshotDate)
    .is('owner_phone', null)
    .not('source_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.error('❌ Query error:', error.message); process.exit(1); }
  if (!rows?.length) { console.log(`✅ Zenginleştirilecek ilan yok (snapshot ${snapshotDate}, limit ${limit}).`); return; }

  console.log(`📞 ${rows.length} sahibi ilanın telefonu çekilecek...\n`);

  const cookies = JSON.parse(fs.readFileSync(path.join(__dirname, 'cookies.json'), 'utf8'));
  const browser = await puppeteerExtra.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setCookie(...cookies);

  let ok = 0, empty = 0, err = 0, blocked = 0;

  for (const [i, row] of rows.entries()) {
    const r = await extractFromPage(page, row.source_url);
    const tail = row.source_url.slice(-25);

    if (r.blocked) {
      console.log(`⛔ [${i + 1}/${rows.length}] ENGEL — durduruluyor`);
      blocked++; break;
    }
    if (r.error) { err++; console.log(`❌ [${i + 1}/${rows.length}] ${tail} — ${r.error}`); continue; }
    if (!r.phone) { empty++; console.log(`⚪ [${i + 1}/${rows.length}] ${tail} — telefon yok`); }

    // Aynı source_id aynı snapshot'ta unique, id ile update et
    const { error: upErr } = await sb
      .from('emlak_daily_leads')
      .update({
        owner_phone: r.phone || '',
        owner_name: r.ownerName || null,
        owner_enriched_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (upErr) { err++; console.log(`❌ DB yazım: ${upErr.message}`); }
    else if (r.phone) { ok++; console.log(`✅ [${i + 1}/${rows.length}] ${tail} → ${r.phone}`); }

    await sleep(3000, 5000);
  }

  await browser.close();

  console.log(`\n═══════ ÖZET ═══════`);
  console.log(`  Telefon bulundu: ${ok}`);
  console.log(`  Telefon yok (marked): ${empty}`);
  console.log(`  Hata: ${err}`);
  if (blocked) console.log(`  ⚠️ ENGEL yedi — cookie yenile ya da bekle`);
}

main().catch(e => { console.error(e); process.exit(1); });
