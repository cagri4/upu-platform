#!/usr/bin/env node
// validate-vercel-cron.mjs
//
// vercel.json içindeki tüm cron schedule'larını Vercel Hobby plan limitlerine
// karşı doğrular. Yasak pattern bulursa exit 1 → pre-commit hook commit'i bloklar.
//
// Hobby plan: her cron schedule GÜNDE EN FAZLA 1 KEZ çalışabilir.
// Yasak: */N (her N dk), 0 * * * * (saatlik), 0 */N * * * (her N saat)
// İzinli: MM HH * * * (günlük), MM HH * * D (haftalık), MM HH D * * (aylık)

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const VERCEL_JSON = resolve(process.cwd(), "vercel.json");

if (!existsSync(VERCEL_JSON)) {
  process.exit(0); // vercel.json yok, validate edecek bir şey yok
}

let config;
try {
  config = JSON.parse(readFileSync(VERCEL_JSON, "utf8"));
} catch (err) {
  console.error(`[vercel-cron] vercel.json parse hatası: ${err.message}`);
  process.exit(1);
}

const crons = config?.crons ?? [];
if (!Array.isArray(crons) || crons.length === 0) {
  process.exit(0);
}

const errors = [];

function validateSchedule(schedule, path) {
  if (typeof schedule !== "string") {
    return `${path}: schedule string olmalı, oldu: ${typeof schedule}`;
  }

  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    return `${path}: schedule 5 alan olmalı (dk sa gun ay haftagunu), oldu: "${schedule}"`;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Yasak 1: dk alanında */N veya step (her N dk bir tetikler)
  if (/^\*\/\d+$/.test(minute) || minute.includes(",") || /\d+-\d+/.test(minute)) {
    return `${path}: dakika alanı "*/N", virgül veya aralık içeremez. "${schedule}" Hobby planında günde 1+ kez çalışır.`;
  }

  // Yasak 2: saat * (her saat tetikler) — günde 24 kez
  if (hour === "*") {
    return `${path}: saat alanı "*" Hobby planında yasak. "${schedule}" günde 24 kez çalışır.`;
  }

  // Yasak 3: saat */N (her N saatte tetikler) — günde 24/N kez
  if (/^\*\/\d+$/.test(hour)) {
    return `${path}: saat alanı "*/N" Hobby planında yasak. "${schedule}" günde birden çok çalışır.`;
  }

  // Yasak 4: saat aralığı veya virgül (örn 8-18, 9,12,15)
  if (hour.includes(",") || /\d+-\d+/.test(hour)) {
    return `${path}: saat alanı virgül veya aralık içeremez. "${schedule}" Hobby planında günde 1+ kez çalışır.`;
  }

  // Dakika alanı * de yasak (saat alanı tek değer olsa bile, * dk = 60 kez)
  if (minute === "*") {
    return `${path}: dakika alanı "*" yasak. "${schedule}" günde 1+ kez çalışır.`;
  }

  return null;
}

crons.forEach((cron, idx) => {
  const path = cron.path || `crons[${idx}]`;
  const err = validateSchedule(cron.schedule, path);
  if (err) errors.push(err);
});

if (errors.length > 0) {
  console.error("\n❌ vercel.json HOBBY PLAN KURALI İHLALİ:\n");
  errors.forEach((e) => console.error(`  • ${e}`));
  console.error("\n💡 Düzeltme: her cron günde EN FAZLA 1 kez çalışmalı.");
  console.error("   İzinli pattern örnekleri:");
  console.error('     "0 5 * * *"   — her gün saat 05:00');
  console.error('     "30 9 * * 1"  — her pazartesi 09:30');
  console.error('     "0 0 1 * *"   — her ayın 1\'i 00:00');
  console.error("\n   Yasak pattern örnekleri:");
  console.error('     "0 * * * *"   — saatlik (24 kez/gün)');
  console.error('     "*/15 * * * *" — her 15 dk (96 kez/gün)');
  console.error('     "0 */6 * * *" — her 6 saat (4 kez/gün)\n');
  console.error("📖 Detay: ~/.claude/projects/-home-cagr-claude-telegram-channel/memory/feedback_verify_vercel_deploy.md\n");
  process.exit(1);
}

console.log(`[vercel-cron] ✅ ${crons.length} cron schedule Hobby planı ile uyumlu.`);
process.exit(0);
