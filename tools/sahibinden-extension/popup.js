/**
 * Popup UI — Tara/Durdur butonu + son scrape özeti + WS bağlantı badge.
 */

import { BRIDGE_HTTP } from "./config.js";

const statusEl = document.getElementById("status");
const connEl = document.getElementById("conn");
const lastTimeEl = document.getElementById("lastTime");
const lastSavedEl = document.getElementById("lastSaved");
const lastTotalEl = document.getElementById("lastTotal");
const lastErrorsEl = document.getElementById("lastErrors");

document.getElementById("trigger").addEventListener("click", async () => {
  statusEl.textContent = "tetiklendi";
  statusEl.className = "badge warn";
  try {
    const r = await fetch(`${BRIDGE_HTTP}/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "manual" }),
    });
    const d = await r.json();
    statusEl.textContent = d.immediate ? "çalışıyor" : "kuyrukta";
    statusEl.className = "badge ok";
  } catch (err) {
    statusEl.textContent = "server kapalı";
    statusEl.className = "badge err";
  }
});

document.getElementById("stop").addEventListener("click", async () => {
  try {
    await fetch(`${BRIDGE_HTTP}/stop`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    statusEl.textContent = "durduruldu";
    statusEl.className = "badge warn";
  } catch {
    statusEl.textContent = "server kapalı";
    statusEl.className = "badge err";
  }
});

async function refresh() {
  // Server status
  try {
    const r = await fetch(`${BRIDGE_HTTP}/status`);
    if (r.ok) {
      const d = await r.json();
      connEl.textContent = d.connected ? `✅ ${d.extensionCount}` : "❌ yok";
      if (d.lastScrape) {
        const ts = new Date(d.lastScrape.finishedAt).toLocaleString("tr-TR");
        lastTimeEl.textContent = ts;
        lastSavedEl.textContent = d.lastScrape.totalSaved ?? "—";
        lastTotalEl.textContent = d.lastScrape.totalListings ?? "—";
        lastErrorsEl.textContent = d.lastScrape.errorCount ?? 0;
      }
      if (d.queue && d.queue.length > 0) {
        statusEl.textContent = d.queue[0].status || "running";
        statusEl.className = "badge ok";
      } else if (statusEl.textContent === "…") {
        statusEl.textContent = "boşta";
        statusEl.className = "badge ok";
      }
    } else {
      connEl.textContent = "server " + r.status;
    }
  } catch {
    connEl.textContent = "server ❌";
    if (statusEl.textContent === "…") {
      statusEl.textContent = "server kapalı";
      statusEl.className = "badge err";
    }
  }

  // Local storage backup'tan son totals (server restart olmuşsa)
  const stored = await chrome.storage.local.get(["lastTotals", "lastFinish"]);
  if (stored.lastFinish && lastTimeEl.textContent === "—") {
    lastTimeEl.textContent = new Date(stored.lastFinish).toLocaleString("tr-TR");
    if (stored.lastTotals) {
      lastSavedEl.textContent = stored.lastTotals.saved ?? "—";
      lastTotalEl.textContent = stored.lastTotals.listings ?? "—";
      lastErrorsEl.textContent = stored.lastTotals.errors ?? 0;
    }
  }
}

refresh();
setInterval(refresh, 3000);
