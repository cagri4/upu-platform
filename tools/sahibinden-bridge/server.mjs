#!/usr/bin/env node
/**
 * Sahibinden Bridge Server
 * ─────────────────────────
 * Telegram bot ve cron tetiklemelerini Chrome extension'a ileten lokal köprü.
 *
 * Akış:
 *   1) POST /trigger  (Telegram / cron / manual popup)
 *   2) Server in-memory queue'ya pending komut yazar (single-pending semantik)
 *   3) WebSocket connected extension varsa hemen "start-scrape" broadcast
 *   4) Extension 23 URL'i sırayla açar, DOM parse, POST /listings
 *   5) Server her listing'i sahibi + Bodrum filter'dan geçirir, Supabase'e upsert
 *   6) POST /scrape-done → Telegram notification + queue temizleme
 *   7) POST /captcha-detected → pause + Telegram notification
 *   8) POST /resume → extension'a "resume" broadcast
 *
 * Anti-bot bypass: server doğrudan sahibinden'e hiç request atmaz; sadece
 * extension'dan gelen DOM parse sonuçlarını alır. Sahibinden açısından
 * normal kullanıcı tarayıcı trafiği.
 */

import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── ENV ────────────────────────────────────────────────────────────────
loadDotEnv(path.join(__dirname, ".env"));

const PORT = parseInt(process.env.PORT || "3001", 10);
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  log("warn", "Supabase env eksik — listings upsert FAIL edecek");
}

// ── BODRUM FILTER (import-v3.mjs'den birebir reuse) ────────────────────
const BODRUM_KEYWORDS = [
  "bodrum", "yalıkavak", "bitez", "turgutreis", "gündoğan", "göltürkbükü",
  "gümüşlük", "konacık", "yalı", "mumcular", "ortakent", "kızılağaç",
  "akyarlar", "karaincir", "geriş", "küçükbük", "dirmil", "halikarnas",
  "dağbelen", "yahşi", "torba", "salih", "çiftlik", "yenice", "adabükü",
  "güvercinlik", "peksimet", "gölköy", "kumbahçe", "farilya", "ada",
];

function isBodrumNeighborhood(text) {
  if (!text) return false;
  const lower = text.toLocaleLowerCase("tr-TR");
  return BODRUM_KEYWORDS.some((k) => lower.includes(k));
}

// ── STATE ──────────────────────────────────────────────────────────────
const SUPABASE_AUTH = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const state = {
  // Single pending queue — duplicate trigger geldiğinde aynı sessionId döner
  pending: null,        // { sessionId, source, queuedAt, status: 'pending'|'running'|'paused' }
  lastScrape: null,     // { sessionId, totalListings, totalSaved, finishedAt }
  wsClients: new Set(), // connected extension(s)
  // Cookie self-test durumu — extension /login-required veya /cookie-refresh
  // call ettiğinde güncellenir. claude-telegram-bot polling ile sorgulayabilir.
  cookieStatus: {
    ok: null,           // null = bilinmiyor, true/false = bilinen son durum
    expiredSince: null, // expired olduğu andan beri timestamp (ms)
    recoveredAt: null,  // son auto-recover timestamp
    lastUpdate: null,
  },
};

// ── EXPRESS ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/status", (_req, res) => {
  res.json({
    queue: state.pending ? [state.pending] : [],
    connected: state.wsClients.size > 0,
    extensionCount: state.wsClients.size,
    lastScrape: state.lastScrape,
  });
});

app.post("/trigger", (req, res) => {
  const source = req.body?.source || "unknown";

  if (state.pending && state.pending.status !== "paused") {
    log("info", `trigger ignored — already pending (${state.pending.sessionId})`, { source });
    return res.json({
      queued: false,
      immediate: false,
      queueId: state.pending.sessionId,
      reason: "already_pending",
    });
  }

  const sessionId = randomUUID();
  state.pending = { sessionId, source, queuedAt: Date.now(), status: "pending" };
  log("info", `trigger queued`, { sessionId, source });

  let immediate = false;
  if (state.wsClients.size > 0) {
    broadcast({ type: "start-scrape", sessionId });
    state.pending.status = "running";
    immediate = true;
    log("info", `start-scrape broadcast`, { sessionId, clients: state.wsClients.size });
  }

  res.json({ queued: true, immediate, queueId: sessionId });
});

app.post("/listings", async (req, res) => {
  const { sessionId, category, listings } = req.body || {};
  if (!Array.isArray(listings)) {
    return res.status(400).json({ error: "listings must be array" });
  }

  // Sahibi-only filter (extension'dan listed_by gelir; emlakçı varsa at)
  const sahibi = listings.filter((l) => (l.listed_by || "").toLowerCase() === "sahibi");

  // Bodrum keyword filter (neighborhood string'inden)
  const bodrum = sahibi.filter((l) => isBodrumNeighborhood(l.neighborhood));

  log("info", `listings received`, {
    sessionId,
    category,
    total: listings.length,
    sahibi: sahibi.length,
    bodrum: bodrum.length,
  });

  if (bodrum.length === 0) {
    return res.json({ saved: 0, skipped: listings.length, reason: "no_bodrum" });
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const rows = bodrum.map((l) => mapRow(l, snapshotDate));

  let saved = 0;
  let errors = 0;
  try {
    // PostgREST: on_conflict query param ŞART, yoksa Prefer header'ı tek başına
    // çalışmaz ve duplicate'larda tüm batch 409 fail eder.
    const r = await fetch(`${SUPABASE_URL}/rest/v1/emlak_daily_leads?on_conflict=source_id,snapshot_date`, {
      method: "POST",
      headers: {
        ...SUPABASE_AUTH,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (r.ok) {
      saved = rows.length;
    } else {
      errors = rows.length;
      const text = await r.text();
      log("error", `supabase upsert fail`, { status: r.status, text: text.slice(0, 300) });
    }
  } catch (err) {
    errors = rows.length;
    log("error", `supabase fetch fail`, { error: err.message });
  }

  res.json({ saved, skipped: listings.length - saved, errors });
});

app.post("/scrape-done", async (req, res) => {
  const { sessionId, totalListings, totalSaved, totalSkipped, duration, errors } = req.body || {};

  state.lastScrape = {
    sessionId,
    totalListings: totalListings || 0,
    totalSaved: totalSaved || 0,
    totalSkipped: totalSkipped || 0,
    duration: duration || 0,
    errorCount: Array.isArray(errors) ? errors.length : 0,
    finishedAt: Date.now(),
  };
  if (state.pending?.sessionId === sessionId) {
    state.pending = null;
  }
  log("info", `scrape done`, state.lastScrape);

  const mins = duration ? (duration / 60000).toFixed(1) : "?";
  await tgNotify(
    `✅ Sahibinden tarama bitti\n` +
      `• Toplam: ${totalListings || 0} ilan\n` +
      `• Kaydedilen: ${totalSaved || 0}\n` +
      `• Atlanan: ${totalSkipped || 0}\n` +
      `• Süre: ${mins} dk` +
      (Array.isArray(errors) && errors.length > 0 ? `\n• Hata: ${errors.length}` : ""),
  );

  // Defense-in-depth — content.js login-detect + bg.js handler tetiklenmediyse
  // de scrape-done seviyesinde silent fail'i yakala. 0 listing + > 5dk süre
  // = full cron çalışmış ama cookie expire kuvvetli sinyali (test mode short
  // run'larda false-positive olmasın diye duration threshold).
  if ((totalListings || 0) === 0 && (duration || 0) > 5 * 60 * 1000) {
    log("warn", `silent zero-listing scrape — likely cookie expire`, { sessionId, duration });
    await tgNotify(
      `🚨 Scrape tamamlandı ama 0 listing — cookie expire ihtimali yüksek.\n` +
        `Chrome → sahibinden.com → Giriş Yap → bir ilana tıkla (warmup).\n` +
        `Sonra cron yeniden tetiklenecek (08:00/18:00) veya manuel POST /trigger.`,
    );
  }

  res.json({ ok: true });
});

app.post("/captcha-detected", async (req, res) => {
  const { sessionId, url, category } = req.body || {};
  log("warn", `captcha detected`, { sessionId, url, category });

  if (state.pending?.sessionId === sessionId) {
    state.pending.status = "paused";
  }

  await tgNotify(
    `⚠️ Captcha geldi: ${category || "bilinmeyen kategori"}\n` +
      `URL: ${url || "?"}\n` +
      `Chrome'da çöz, 'devam' yaz (POST /resume).`,
  );

  res.json({ ok: true, status: "paused" });
});

app.post("/login-required", async (req, res) => {
  const { sessionId, url, category, reason } = req.body || {};
  log("warn", `login required (cookie expire)`, { sessionId, url, category, reason });

  if (state.pending?.sessionId === sessionId) {
    state.pending.status = "login-required";
  }

  // Cookie status'i expired olarak güncelle (auto-recover takip için)
  state.cookieStatus = {
    ok: false,
    expiredSince: state.cookieStatus?.expiredSince || Date.now(),
    recoveredAt: null,
    lastUpdate: Date.now(),
  };

  const shortId = (sessionId || "").slice(0, 8);
  await tgNotify(
    `⚠️ Sahibinden cookie expire — extension otomatik resume bekliyor.\n\n` +
      `Chrome'da sahibinden.com aç (1 sayfa gez yeter); extension cookie'yi yakalayıp scrape'i otomatik devam ettirir.\n\n` +
      `Session: ${shortId}, kategori: ${category || "?"}, reason: ${reason || "?"}`,
  );

  res.json({ ok: true, status: "login-required" });
});

app.post("/cookie-refresh", (req, res) => {
  // Extension auto-recovery polling cookie OK aldığında çağırır.
  const now = Date.now();
  const wasExpiredSince = state.cookieStatus?.expiredSince || null;
  state.cookieStatus = {
    ok: true,
    expiredSince: null,
    recoveredAt: now,
    lastUpdate: now,
  };
  const ageMs = wasExpiredSince ? now - wasExpiredSince : 0;
  log("info", `cookie auto-recovered`, { ageMs, ageMin: Math.round(ageMs / 60000) });
  // Resume zaten paused scrape'i extension kendi içinde processNext ediyor;
  // server'ın WS broadcast'i opsiyonel (mid-scrape login-required durumunda
  // ekstra signal için)
  if (state.pending && state.pending.status === "login-required") {
    state.pending.status = "running";
    broadcast({ type: "resume", sessionId: state.pending.sessionId });
  }
  res.json({ ok: true, cookieStatus: state.cookieStatus });
});

app.get("/cookie-status", (_req, res) => {
  res.json({
    ok: state.cookieStatus?.ok ?? null,
    expiredSince: state.cookieStatus?.expiredSince ?? null,
    recoveredAt: state.cookieStatus?.recoveredAt ?? null,
    lastUpdate: state.cookieStatus?.lastUpdate ?? null,
    expiredAgeMin: state.cookieStatus?.expiredSince
      ? Math.round((Date.now() - state.cookieStatus.expiredSince) / 60000)
      : null,
  });
});

app.post("/resume", (req, res) => {
  const { sessionId } = req.body || {};
  const target = sessionId || state.pending?.sessionId;
  if (!target || state.pending?.sessionId !== target) {
    return res.status(404).json({ error: "no paused session" });
  }
  state.pending.status = "running";
  broadcast({ type: "resume", sessionId: target });
  log("info", `resume broadcast`, { sessionId: target });
  res.json({ ok: true, resumed: target });
});

app.post("/stop", (req, res) => {
  const sessionId = state.pending?.sessionId || null;
  state.pending = null;
  if (sessionId) broadcast({ type: "stop", sessionId });
  log("info", `stop broadcast`, { sessionId });
  res.json({ ok: true, stopped: sessionId });
});

app.post("/reload-extension", (_req, res) => {
  broadcast({ type: "reload" });
  log("info", `reload broadcast`, { clients: state.wsClients.size });
  res.json({ ok: true, clients: state.wsClients.size });
});

// ── HTTP + WS BOOTSTRAP ────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  state.wsClients.add(ws);
  log("info", `extension connected`, { total: state.wsClients.size });

  // Eğer queue'da pending varsa hemen tetikle (extension geç bağlanmış olabilir)
  if (state.pending && state.pending.status === "pending") {
    ws.send(JSON.stringify({ type: "start-scrape", sessionId: state.pending.sessionId }));
    state.pending.status = "running";
    log("info", `late-bind start-scrape sent`, { sessionId: state.pending.sessionId });
  }

  // Heartbeat — 30 sn ping, response yoksa terminate
  let alive = true;
  ws.on("pong", () => (alive = true));
  const heartbeat = setInterval(() => {
    if (!alive) {
      log("warn", `extension heartbeat lost, terminating`);
      ws.terminate();
      return;
    }
    alive = false;
    try { ws.ping(); } catch { /* yut */ }
  }, 30000);

  ws.on("close", () => {
    clearInterval(heartbeat);
    state.wsClients.delete(ws);
    log("info", `extension disconnected`, { total: state.wsClients.size });
  });

  ws.on("error", (err) => {
    log("warn", `ws error`, { error: err.message });
  });
});

function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const client of state.wsClients) {
    if (client.readyState === 1) {
      try { client.send(data); } catch { /* yut */ }
    }
  }
}

server.listen(PORT, "127.0.0.1", () => {
  log("info", `listening`, { url: `http://127.0.0.1:${PORT}` });
});

// ── HELPERS ────────────────────────────────────────────────────────────
function mapRow(l, snapshotDate) {
  return {
    source_id: l.source_id || extractListingId(l.url),
    source_url: l.url || l.source_url,
    snapshot_date: snapshotDate,
    title: l.title || null,
    type: l.property_type || null,
    listing_type: l.listing_type || null,
    price: l.price || null,
    area: l.area_m2 ? Math.round(l.area_m2) : (l.area || null),
    rooms: l.rooms || null,
    location_city: "Muğla",
    location_district: "Bodrum",
    location_neighborhood: l.neighborhood || null,
    listing_date: parseTurkishDate(l.date),
    image_url: l.photo || null,
  };
}

function extractListingId(url) {
  if (!url) return null;
  const m = url.match(/[-/](\d{7,12})(?:\/|$|\?)/);
  return m ? m[1] : null;
}

const TR_MONTH = {
  ocak: "01", şubat: "02", mart: "03", nisan: "04", mayıs: "05",
  haziran: "06", temmuz: "07", ağustos: "08", eylül: "09",
  ekim: "10", kasım: "11", aralık: "12",
};
function parseTurkishDate(str) {
  if (!str) return null;
  const m = str.toLowerCase().trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (!m) return null;
  const day = m[1].padStart(2, "0");
  const month = TR_MONTH[m[2]];
  if (!month) return null;
  return `${m[3]}-${month}-${day}`;
}

async function tgNotify(text) {
  if (!TG_TOKEN || !TG_CHAT) {
    log("info", `telegram skip — env yok`, { textLen: text.length });
    return;
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
    });
    if (!r.ok) log("warn", `telegram send fail`, { status: r.status });
  } catch (err) {
    log("warn", `telegram send error`, { error: err.message });
  }
}

function log(level, msg, data) {
  const entry = { ts: new Date().toISOString(), level, msg, ...(data || {}) };
  console.log(JSON.stringify(entry));
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
