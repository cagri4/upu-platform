#!/usr/bin/env node
/**
 * Import v3-bodrum.json → Supabase emlak_properties
 * Sistem kullanicisi V3: 93671f0e-8515-47fa-842c-a35d1617eadb
 *
 * Duplicate handling: pre-fetch mevcut source_id'ler, client-side diff al,
 * sadece gerçekten yeni kayıtları insert et. Supabase
 * `resolution=ignore-duplicates` batch-sessiz-atlıyor ve 201 dönüyor; eski
 * versiyon bu yüzden "+X yeni" diye şişirilmiş sayı raporluyordu.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, 'output', 'v3-bodrum.json');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SYSTEM_USER_ID = process.env.SCRAPER_USER_ID || '93671f0e-8515-47fa-842c-a35d1617eadb';
const TENANT_ID = process.env.EMLAK_TENANT_ID || '3f3598fc-a93e-4c73-bd33-7c4217f6c089';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY env degiskenleri gerekli.');
  console.error('Kullanim: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-v3.mjs');
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
  return `${year}-${month}-${day}T00:00:00Z`;
}

const AUTH_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

async function fetchExistingIds(incomingIds) {
  const existing = new Set();
  const CHUNK = 300;
  for (let i = 0; i < incomingIds.length; i += CHUNK) {
    const chunk = incomingIds.slice(i, i + CHUNK);
    const inFilter = chunk.map(x => `"${String(x).replace(/"/g, '\\"')}"`).join(',');
    const url = `${SUPABASE_URL}/rest/v1/emlak_properties?select=source_id&source_id=in.(${inFilter})`;
    const r = await fetch(url, { headers: AUTH_HEADERS });
    if (!r.ok) {
      console.log(`  ! existing fetch hata: ${r.status}`);
      continue;
    }
    const rows = await r.json();
    for (const row of rows) existing.add(row.source_id);
  }
  return existing;
}

function mapRow(l) {
  return {
    tenant_id: TENANT_ID,
    user_id: SYSTEM_USER_ID,
    title: l.title,
    type: l.property_type,
    listing_type: l.listing_type,
    listed_by: l.listed_by || null,
    status: 'aktif',
    price: l.price || 0,
    location_city: 'Muğla',
    location_district: 'Bodrum',
    location_neighborhood: l.neighborhood || null,
    area: l.area_m2 || 0,
    rooms: l.rooms || null,
    image_url: l.photo || null,
    source_id: l.source_id,
    source_url: l.source_url,
    source_portal: 'sahibinden',
    listing_date: parseTurkishDate(l.date),
    shared_in_network: true,
  };
}

async function importData() {
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Toplam: ${data.length} ilan`);

  const withIds = data.filter(l => l.source_id);
  const incomingIds = [...new Set(withIds.map(l => l.source_id))];
  console.log(`  Benzersiz source_id: ${incomingIds.length}`);

  const existing = await fetchExistingIds(incomingIds);
  console.log(`  Mevcut DB'de: ${existing.size}`);

  const fresh = withIds.filter(l => !existing.has(l.source_id));
  const skipped = data.length - fresh.length;
  console.log(`  Yeni (insert edilecek): ${fresh.length}\n`);

  if (fresh.length === 0) {
    console.log(`══════════════════════════════════════`);
    console.log(`📊 IMPORT OZET`);
    console.log(`  Eklenen: 0`);
    console.log(`  Atlanan (duplicate): ${skipped}`);
    console.log(`  Hata: 0`);
    return;
  }

  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < fresh.length; i += BATCH_SIZE) {
    const batch = fresh.slice(i, i + BATCH_SIZE);
    const rows = batch.map(mapRow);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/emlak_properties`, {
      method: 'POST',
      headers: {
        ...AUTH_HEADERS,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });

    if (res.ok) {
      inserted += batch.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: +${batch.length} (toplam: ${inserted})`);
    } else {
      const err = await res.text();
      // Nadir race condition — aynı source_id başka bir run tarafından önce eklendiyse
      if (err.includes('idx_properties_source_id') || err.includes('duplicate')) {
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: race duplicate, tek tek deneniyor...`);
        for (const row of rows) {
          const r2 = await fetch(`${SUPABASE_URL}/rest/v1/emlak_properties`, {
            method: 'POST',
            headers: {
              ...AUTH_HEADERS,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=ignore-duplicates,return=minimal',
            },
            body: JSON.stringify(row),
          });
          if (r2.ok) inserted++;
          else {
            const e2 = await r2.text();
            if (!(e2.includes('duplicate') || e2.includes('idx_properties_source_id'))) {
              errors++;
              if (errors <= 3) console.log('    HATA:', e2.substring(0, 200));
            }
          }
        }
      } else {
        errors += batch.length;
        console.log(`  Batch HATA: ${err.substring(0, 300)}`);
      }
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`📊 IMPORT OZET`);
  console.log(`  Eklenen: ${inserted}`);
  console.log(`  Atlanan (duplicate): ${skipped}`);
  console.log(`  Hata: ${errors}`);
}

importData().catch(console.error);
