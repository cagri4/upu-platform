#!/usr/bin/env node
/**
 * Import v3-bodrum.json → Supabase emlak_daily_leads
 *
 * Günlük lead pipeline:
 * - Bugünün scrape'ini emlak_daily_leads'a INSERT (snapshot_date = CURRENT_DATE)
 * - 7 günden eski snapshot'ları DELETE (rolling 7-day window)
 * - Sadece sahibi ilanları (listed_by=sahibi) bu tabloya yazılır
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'output', 'v3-bodrum.json');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY env degiskenleri gerekli.');
  process.exit(1);
}

const TR_MONTHS = {
  'ocak': '01', 'şubat': '02', 'subat': '02', 'mart': '03', 'nisan': '04',
  'mayıs': '05', 'mayis': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08',
  'agustos': '08', 'eylül': '09', 'eylul': '09', 'ekim': '10', 'kasım': '11',
  'kasim': '11', 'aralık': '12', 'aralik': '12',
};

function parseTurkishDate(text) {
  if (!text) return null;
  const match = text.trim().match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = TR_MONTHS[match[2].toLowerCase()];
  const year = match[3];
  if (!month) return null;
  return `${year}-${month}-${day}`;
}

const AUTH = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

function mapRow(l, snapshotDate) {
  return {
    source_id: l.source_id,
    source_url: l.source_url,
    snapshot_date: snapshotDate,
    title: l.title,
    type: l.property_type,
    listing_type: l.listing_type,
    price: l.price || null,
    area: l.area_m2 ? Math.round(l.area_m2) : null,
    rooms: l.rooms || null,
    location_city: 'Muğla',
    location_district: 'Bodrum',
    location_neighborhood: l.neighborhood || null,
    listing_date: parseTurkishDate(l.date),
    image_url: l.photo || null,
  };
}

async function deleteOldSnapshots() {
  // TODAY-ONLY retention: her sabah önceki günlerin snapshot'ları silinir.
  const today = new Date().toISOString().slice(0, 10);
  const url = `${SUPABASE_URL}/rest/v1/emlak_daily_leads?snapshot_date=lt.${today}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...AUTH, Prefer: 'return=minimal' },
  });
  if (res.ok) {
    console.log(`  🗑️  Önceki günlerin snapshot'ları silindi (< ${today})`);
  } else {
    console.log(`  ⚠️  Cleanup hata: ${res.status}`);
  }
}

async function importData() {
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  // daily_leads sadece sahibi kayıtlarını tutar — emlakçı varsa filtrele
  const sahibi = data.filter(l => l.listed_by === 'sahibi');
  console.log(`Toplam scrape: ${data.length} ilan (sahibi: ${sahibi.length}, emlakçı: ${data.length - sahibi.length})`);

  if (sahibi.length === 0) {
    console.log('⚠️  Sahibi kayıt yok, import atlandı.');
    return;
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);
  console.log(`Snapshot date: ${snapshotDate}`);

  // Bu snapshot_date için mevcut source_id'leri getir (idempotent re-run için)
  const incomingIds = [...new Set(sahibi.map(l => l.source_id))];
  const existing = new Set();
  const CHUNK = 300;
  for (let i = 0; i < incomingIds.length; i += CHUNK) {
    const chunk = incomingIds.slice(i, i + CHUNK);
    const inFilter = chunk.map(x => `"${String(x).replace(/"/g, '\\"')}"`).join(',');
    const url = `${SUPABASE_URL}/rest/v1/emlak_daily_leads?select=source_id&snapshot_date=eq.${snapshotDate}&source_id=in.(${inFilter})`;
    const r = await fetch(url, { headers: AUTH });
    if (r.ok) {
      const rows = await r.json();
      for (const row of rows) existing.add(row.source_id);
    }
  }

  const fresh = sahibi.filter(l => !existing.has(l.source_id));
  console.log(`  Bu snapshot'ta zaten var: ${existing.size}, yeni: ${fresh.length}`);

  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batch = fresh.slice(i, i + BATCH_SIZE);
    const rows = batch.map(l => mapRow(l, snapshotDate));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/emlak_daily_leads`, {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });

    if (res.ok) {
      inserted += batch.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: +${batch.length} (toplam: ${inserted})`);
    } else {
      const err = await res.text();
      errors += batch.length;
      console.log(`  Batch HATA: ${err.substring(0, 300)}`);
    }
  }

  await deleteOldSnapshots();

  console.log(`\n══════════════════════════════════════`);
  console.log(`📊 IMPORT OZET`);
  console.log(`  Eklenen: ${inserted}`);
  console.log(`  Atlanan (duplicate): ${existing.size}`);
  console.log(`  Hata: ${errors}`);
}

importData().catch(err => {
  console.error('[import-v3] Fatal:', err);
  process.exit(1);
});
