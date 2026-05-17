/**
 * Sahibinden Bridge — service worker (background)
 *
 *   1) WS connect ws://127.0.0.1:3001/ws (reconnect 5sn)
 *   2) "start-scrape" mesajı → 23 URL sırayla yeni tab'da aç (60sn aralık)
 *   3) Tab loaded → content script'e "parse" mesajı → cevabı /listings'e POST
 *   4) Captcha tespiti → /captcha-detected → pause + WS "resume" bekle
 *   5) Tamamlandığında /scrape-done
 */

import {
  SAHIBINDEN_TARGETS,
  BRIDGE_HTTP,
  BRIDGE_WS,
  TAB_TIMEOUT_MS,
  TAB_INTERVAL_MS,
  CONTENT_DOM_WAIT_MS,
} from "./config.js";

let ws = null;
let wsReconnectTimer = null;
let session = null; // { id, startedAt, totalListings, totalSaved, totalSkipped, errors, paused, abort }
const pendingResume = []; // resume promise resolvers

connectWs();

function connectWs() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  try {
    ws = new WebSocket(BRIDGE_WS);
  } catch (err) {
    console.warn("[bg] WS new() fail:", err.message);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    console.log("[bg] WS connected:", BRIDGE_WS);
  });

  ws.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    console.log("[bg] WS msg:", msg);
    handleServerMessage(msg);
  });

  ws.addEventListener("close", () => {
    console.log("[bg] WS closed, reconnecting in 5s");
    ws = null;
    scheduleReconnect();
  });

  ws.addEventListener("error", (err) => {
    console.warn("[bg] WS error:", err);
  });
}

function scheduleReconnect() {
  if (wsReconnectTimer) return;
  wsReconnectTimer = setTimeout(connectWs, 5000);
}

function handleServerMessage(msg) {
  if (msg.type === "start-scrape") {
    if (session && !session.aborted) {
      console.warn("[bg] start-scrape ignored — already running:", session.id);
      return;
    }
    void runScrape(msg.sessionId);
  } else if (msg.type === "resume") {
    while (pendingResume.length > 0) {
      const resolve = pendingResume.shift();
      try { resolve(); } catch { /* yut */ }
    }
  } else if (msg.type === "stop") {
    if (session) {
      session.aborted = true;
      while (pendingResume.length > 0) {
        const resolve = pendingResume.shift();
        try { resolve(); } catch { /* yut */ }
      }
    }
  }
}

async function runScrape(sessionId) {
  session = {
    id: sessionId,
    startedAt: Date.now(),
    totalListings: 0,
    totalSaved: 0,
    totalSkipped: 0,
    errors: [],
    aborted: false,
  };

  console.log(`[bg] scrape start ${sessionId} (${SAHIBINDEN_TARGETS.length} URL)`);
  await chrome.storage.local.set({ lastStart: Date.now(), lastStatus: "running" });

  for (let i = 0; i < SAHIBINDEN_TARGETS.length; i++) {
    if (session.aborted) {
      console.log(`[bg] scrape aborted at ${i}/${SAHIBINDEN_TARGETS.length}`);
      break;
    }

    const target = SAHIBINDEN_TARGETS[i];
    const category = `${target.listing_type}/${target.property_type}`;
    console.log(`[bg] [${i + 1}/${SAHIBINDEN_TARGETS.length}] ${category}`);

    try {
      const result = await scrapeCategory(target, sessionId);
      session.totalListings += result.parsed;
      session.totalSaved += result.saved;
      session.totalSkipped += result.skipped;

      if (result.captcha) {
        console.warn(`[bg] captcha at ${category} — paused`);
        await postJson("/captcha-detected", {
          sessionId,
          url: target.url,
          category,
        });
        await waitForResume();
        if (session.aborted) break;
        // Resume sonrası mevcut URL'yi atla, sıradakine geç
        continue;
      }
    } catch (err) {
      console.warn(`[bg] ${category} error:`, err.message);
      session.errors.push({ category, error: err.message });
    }

    // İnsan trafiği — kategoriler arası bekleme (son URL'de gerek yok)
    if (i < SAHIBINDEN_TARGETS.length - 1 && !session.aborted) {
      await sleep(TAB_INTERVAL_MS);
    }
  }

  const duration = Date.now() - session.startedAt;
  await postJson("/scrape-done", {
    sessionId,
    totalListings: session.totalListings,
    totalSaved: session.totalSaved,
    totalSkipped: session.totalSkipped,
    duration,
    errors: session.errors,
  });

  await chrome.storage.local.set({
    lastStatus: session.aborted ? "aborted" : "done",
    lastFinish: Date.now(),
    lastTotals: {
      listings: session.totalListings,
      saved: session.totalSaved,
      skipped: session.totalSkipped,
      errors: session.errors.length,
    },
  });

  console.log(`[bg] scrape done — ${session.totalSaved}/${session.totalListings} saved in ${(duration / 1000).toFixed(1)}s`);
  session = null;
}

function waitForResume() {
  return new Promise((resolve) => pendingResume.push(resolve));
}

async function scrapeCategory(target, sessionId) {
  // 1) Yeni tab aç (background, kullanıcının aktif tab'ını bozma)
  const tab = await chrome.tabs.create({ url: target.url, active: false });
  const tabId = tab.id;

  try {
    // 2) Tab'ın yüklenmesini ve content script'in mount olmasını bekle
    await waitForTabComplete(tabId);

    // 3) Content script'e parse komutu gönder (content_scripts matches ile zaten mount)
    const result = await Promise.race([
      chrome.tabs.sendMessage(tabId, {
        type: "parse",
        category: `${target.listing_type}/${target.property_type}`,
        listing_type: target.listing_type,
        property_type: target.property_type,
        listed_by: target.listed_by,
      }),
      sleep(TAB_TIMEOUT_MS).then(() => ({ timeout: true })),
    ]);

    if (!result || result.timeout) {
      return { parsed: 0, saved: 0, skipped: 0, captcha: false, errors: 1 };
    }

    if (result.captcha) {
      return { parsed: 0, saved: 0, skipped: 0, captcha: true };
    }

    const listings = Array.isArray(result.listings) ? result.listings : [];
    const enriched = listings.map((l) => ({
      ...l,
      listing_type: target.listing_type,
      property_type: target.property_type,
      listed_by: target.listed_by,
    }));

    // 4) /listings POST
    const postRes = await postJson("/listings", {
      sessionId,
      category: `${target.listing_type}/${target.property_type}`,
      listings: enriched,
    });

    return {
      parsed: listings.length,
      saved: postRes?.saved || 0,
      skipped: postRes?.skipped || 0,
      captcha: false,
    };
  } finally {
    // 5) Tab kapat (best-effort)
    try { await chrome.tabs.remove(tabId); } catch { /* zaten kapanmış */ }
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        // Content script + JS render için ekstra bekleme
        setTimeout(resolve, CONTENT_DOM_WAIT_MS);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    // Timeout fallback (30sn)
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    }, 30000);
  });
}

async function postJson(path, body) {
  try {
    const res = await fetch(BRIDGE_HTTP + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn(`[bg] ${path} → ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[bg] ${path} fail:`, err.message);
    return null;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Popup'tan gelen manuel komutlar (POST /trigger { source: "manual" } popup
// kendisi yapacak; burada sadece status query'leri için kanal hazır).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "get-status") {
    sendResponse({
      wsConnected: !!ws && ws.readyState === 1,
      session: session
        ? { id: session.id, totalSaved: session.totalSaved, totalListings: session.totalListings }
        : null,
    });
    return true;
  }
});
