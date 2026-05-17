/**
 * Sahibinden Cookie Bridge — MV3 service worker.
 *
 * Akış:
 *   1) Install → 5 dakikalık alarm kur
 *   2) Her alarm + service worker startup'ta:
 *      a. chrome.cookies.getAll({ domain: ".sahibinden.com" })
 *      b. POST http://localhost:3001/cookies → receiver scripts/cookies.json'ı günceller
 *
 * Receiver kapalıysa fetch sessiz fail eder (next alarm'da retry).
 */

const LOCAL_ENDPOINT = "http://localhost:3001/cookies";
const ALARM_NAME = "export-cookies";
const PERIOD_MINUTES = 5;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MINUTES });
  console.log("[Bridge] Installed, alarm set every", PERIOD_MINUTES, "minutes");
});

chrome.runtime.onStartup.addListener(() => {
  // Browser startup — bir defa export et, sonra alarm her 5 dk
  void exportCookies();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  void exportCookies();
});

// Service worker ilk register oluşunda da bir defa çalıştır (install sonrası
// hemen export). MV3 background bir kez load olur, sonra event-driven yaşar.
void exportCookies();

async function exportCookies() {
  let cookies;
  try {
    cookies = await chrome.cookies.getAll({ domain: ".sahibinden.com" });
  } catch (err) {
    console.warn("[Bridge] cookies.getAll failed:", err.message);
    return;
  }

  if (!cookies || cookies.length === 0) {
    console.warn("[Bridge] No sahibinden cookies found (browse sahibinden.com first)");
    return;
  }

  const formatted = cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite || "Lax",
    expirationDate: c.expirationDate,
  }));

  try {
    const res = await fetch(LOCAL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cookies: formatted,
        exportedAt: new Date().toISOString(),
      }),
    });
    if (res.ok) {
      console.log(`[Bridge] ${cookies.length} cookies exported at ${new Date().toLocaleTimeString()}`);
    } else {
      console.warn("[Bridge] Receiver responded:", res.status);
    }
  } catch (err) {
    // Receiver kapalı olabilir — sessiz, bir sonraki alarm'da tekrar denenir
    console.warn("[Bridge] POST failed (receiver running?):", err.message);
  }
}
