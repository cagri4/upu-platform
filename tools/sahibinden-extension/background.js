/**
 * Sahibinden Bridge — service worker (background)
 *
 *   1) WS connect ws://127.0.0.1:3001/ws (reconnect 5sn)
 *   2) "start-scrape" mesajı → state machine başlat, ilk URL aç
 *   3) Her URL bitince state chrome.storage.local'a persist + alarm SET (60sn)
 *   4) Alarm callback → state oku → next URL (service worker suspend olsa da uyanır)
 *   5) Captcha → /captcha-detected, paused state, "resume" mesajı beklenir
 *   6) Son URL → /scrape-done, state cleanup
 *
 * Tasarım sebebi: MV3 service worker idle'da suspend olur. async sleep(60_000)
 * sırasında suspend → loop state RAM'de kaybolur. Çözüm: state'i storage'a yaz,
 * alarm ile uyandır, kaldığı yerden devam.
 */

import {
  SAHIBINDEN_TARGETS,
  BRIDGE_HTTP,
  BRIDGE_WS,
  TAB_TIMEOUT_MS,
  TAB_INTERVAL_MS,
  CONTENT_DOM_WAIT_MS,
} from "./config.js";

const STATE_KEY = "scrape_state";
const COOKIE_STATE_KEY = "cookie_state";
const STEP_ALARM = "scrape-step";
const KEEPALIVE_ALARM = "ws-keepalive";
const COOKIE_POLL_ALARM = "cookie-poll";

const COOKIE_TEST_URL = "https://www.sahibinden.com/";
const COOKIE_POLL_PERIOD_MIN = 1; // 60sn

// Auto-recover umuyoruz ama 4 saat geçtiyse Chrome notification ile
// kullanıcıyı tetikle (yedek). Bir oturumda tek bildirim — spam önlenir.
const STALE_NOTIFICATION_MS = 4 * 60 * 60 * 1000;
const STALE_NOTIFICATION_ID = "sahibinden-cookie-stale";

let ws = null;
let wsReconnectTimer = null;
let processing = false; // concurrent processNext koruması (in-memory; race window içinde geçerli)

connectWs();

// MV3 keepalive — alarm her 30sn worker'ı uyandırır, WS kopuksa reconnect
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    if (!ws || ws.readyState !== 1) {
      console.log("[bg] keepalive: ws not open, reconnecting");
      connectWs();
    }
    // Pending scrape varsa devam ettir (recovery güvencesi — alarm SET edilmemiş
    // olsa bile next-step çağrılır)
    const st = await getState();
    if (st && st.status === "running" && !st.scheduledNext) {
      console.log("[bg] keepalive: pending scrape var, processNext çağrılıyor");
      void processNext();
    }
    return;
  }
  if (alarm.name === STEP_ALARM) {
    console.log("[bg] step alarm tetiklendi");
    void processNext();
    return;
  }
  if (alarm.name === COOKIE_POLL_ALARM) {
    void pollCookieAndMaybeResume();
    return;
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("[bg] runtime startup");
  if (!ws || ws.readyState !== 1) connectWs();
  // Recovery — startup öncesi pending scrape varsa devam
  const st = await getState();
  if (st && st.status === "running") {
    console.log("[bg] startup: pending scrape resume");
    void processNext();
  }
});

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

async function handleServerMessage(msg) {
  if (msg.type === "start-scrape") {
    const st = await getState();
    if (st && st.status === "running") {
      console.warn("[bg] start-scrape ignored — running:", st.sessionId);
      return;
    }

    // Cookie self-test ÖNCESİ — expired ise scrape başlatmadan pause
    const test = await cookieSelfTest();
    console.log("[bg] cookie self-test:", test);
    await setCookieState({
      ok: test.ok,
      reason: test.reason || null,
      lastCheck: Date.now(),
      expiredSince: test.ok ? null : Date.now(),
    });

    if (!test.ok) {
      console.warn(`[bg] start-scrape paused — cookie ${test.reason}`);
      // Telegram alert + server queue paused state (mevcut /login-required reuse)
      await postJson("/login-required", {
        sessionId: msg.sessionId,
        url: COOKIE_TEST_URL,
        category: "pre-scrape-check",
        reason: `cookie-${test.reason || "unknown"}`,
      });
      // Boş scrape state: index=0 + status=paused, polling cookieOK olunca devam
      await initScrape(msg.sessionId);
      const st0 = await getState();
      if (st0) {
        st0.status = "paused";
        await setState(st0);
      }
      // Poller'ı SET — kullanıcı sahibinden açtığında otomatik resume
      await schedulePollIfExpired();
      return;
    }

    await initScrape(msg.sessionId);
    void processNext();
  } else if (msg.type === "resume") {
    const st = await getState();
    if (st && st.status === "paused") {
      console.log("[bg] resume: paused state'i kaldırıp devam");
      // Captcha gelen URL'i atla, sıradakine geç
      st.status = "running";
      st.index += 1;
      st.scheduledNext = false;
      await setState(st);
      void processNext();
    }
  } else if (msg.type === "stop") {
    const st = await getState();
    if (st && (st.status === "running" || st.status === "paused")) {
      console.log("[bg] stop: aborting", st.sessionId);
      st.status = "aborted";
      await setState(st);
      await chrome.alarms.clear(STEP_ALARM);
      await finalize(st);
    }
  } else if (msg.type === "reload") {
    console.log("[bg] reload command — chrome.runtime.reload()");
    chrome.runtime.reload();
  }
}

// ─── State Machine ───────────────────────────────────────────────────────────

async function getState() {
  const r = await chrome.storage.local.get(STATE_KEY);
  return r[STATE_KEY] || null;
}

async function setState(st) {
  await chrome.storage.local.set({ [STATE_KEY]: st });
}

async function clearState() {
  await chrome.storage.local.remove(STATE_KEY);
}

// ─── Cookie Self-Test ─────────────────────────────────────────────────────
// Scrape öncesi (ve poller içinde) sahibinden ana sayfasına hafif GET.
// Cookie hala geçerli ise body'de "Çıkış Yap"/"hesabım" gibi authenticated
// marker'ları görünür; expired ise /giris'e redirect ya da "Üye Girişi" linki.
// Anti-bot tetiklenmesini önlemek için ana sayfa kullanılıyor (warmup'a
// yakın davranır, listing scrape öncesi doğal trafik).

async function cookieSelfTest() {
  try {
    const r = await fetch(COOKIE_TEST_URL, {
      method: "GET",
      credentials: "include",
      redirect: "follow",
      cache: "no-store",
    });
    if (!r.ok) return { ok: false, reason: `http-${r.status}` };
    if (/\/giris|\/login|olagan-disi/i.test(r.url)) {
      return { ok: false, reason: "redirected-to-login" };
    }
    const html = (await r.text()).slice(0, 80_000);
    // Authenticated marker'ları öncelikli (false-positive riski daha düşük)
    if (/(çıkış\s*yap|hesab[ıi]m|My\s*Account|user-info)/i.test(html)) {
      return { ok: true };
    }
    // Logged-out marker'ları
    if (/(üye\s*girişi|sign-in|giriş\s*yap)/i.test(html)) {
      return { ok: false, reason: "logged-out-marker" };
    }
    // Belirsiz — false-negative tercih (scrape devam etsin, login-required
    // pattern listing parse sırasında zaten yakalar).
    return { ok: true, ambiguous: true };
  } catch (err) {
    return { ok: false, reason: `fetch-fail: ${err?.message || "unknown"}` };
  }
}

async function getCookieState() {
  const r = await chrome.storage.local.get(COOKIE_STATE_KEY);
  return r[COOKIE_STATE_KEY] || null;
}

async function setCookieState(s) {
  await chrome.storage.local.set({ [COOKIE_STATE_KEY]: s });
}

async function schedulePollIfExpired() {
  const cs = await getCookieState();
  if (cs && cs.ok === false) {
    // Mevcut alarm varsa Chrome yenisini ezer; idempotent
    await chrome.alarms.create(COOKIE_POLL_ALARM, {
      delayInMinutes: COOKIE_POLL_PERIOD_MIN,
      periodInMinutes: COOKIE_POLL_PERIOD_MIN,
    });
    console.log("[bg] cookie poll alarm SET (60sn period)");
  }
}

/**
 * Cookie state expired ise self-test tekrarla. OK olunca scrape state'i
 * paused → running'e çek + processNext, alarm CLEAR. Hala expired ise alarm
 * 60sn sonra otomatik tekrar tetikler.
 */
async function pollCookieAndMaybeResume() {
  const cs = await getCookieState();
  if (!cs || cs.ok !== false) {
    // Expired değil — alarm idle, CLEAR
    await chrome.alarms.clear(COOKIE_POLL_ALARM);
    return;
  }

  const test = await cookieSelfTest();
  console.log("[bg] poll cookie:", test);

  await setCookieState({
    ok: test.ok,
    reason: test.reason || null,
    lastCheck: Date.now(),
    expiredSince: test.ok ? null : (cs.expiredSince || Date.now()),
  });

  if (!test.ok) {
    // 4 saatten fazla expired → kullanıcıyı Chrome notification ile tetikle
    await maybeNotifyStale(cs);
    return; // Yine expired — alarm 60sn sonra tekrar tetikler
  }

  // ✓ Cookie tazedi → server'a bildir + scrape resume + notification cleanup
  console.log("[bg] cookie OK — scrape resume");
  await postJson("/cookie-refresh", { recoveredAt: Date.now() });
  await chrome.alarms.clear(COOKIE_POLL_ALARM);
  try { await chrome.notifications.clear(STALE_NOTIFICATION_ID); } catch { /* yut */ }
  await chrome.storage.local.remove("stale_notif_shown_at");

  const st = await getState();
  if (st && st.status === "paused") {
    st.status = "running";
    await setState(st);
    void processNext();
  }
}

async function maybeNotifyStale(cs) {
  if (!cs?.expiredSince) return;
  const ageMs = Date.now() - cs.expiredSince;
  if (ageMs < STALE_NOTIFICATION_MS) return;
  // Daha önce gösterildi mi? (spam önle — bir oturumda tek bildirim)
  const r = await chrome.storage.local.get("stale_notif_shown_at");
  if (r.stale_notif_shown_at) return;
  try {
    await chrome.notifications.create(STALE_NOTIFICATION_ID, {
      type: "basic",
      iconUrl: "icon.png",
      title: "Sahibinden cookie expired",
      message: `${Math.round(ageMs / 60000)} dk önce expire oldu. sahibinden.com'a girin (1 sayfa gez), extension scrape'i otomatik devam ettirir.`,
      priority: 2,
      requireInteraction: true,
    });
    await chrome.storage.local.set({ stale_notif_shown_at: Date.now() });
    console.log("[bg] stale cookie notification gösterildi");
  } catch (err) {
    console.warn("[bg] notifications.create fail:", err?.message);
  }
}

chrome.notifications.onClicked.addListener(async (notifId) => {
  if (notifId !== STALE_NOTIFICATION_ID) return;
  try { await chrome.tabs.create({ url: COOKIE_TEST_URL, active: true }); } catch { /* yut */ }
  try { await chrome.notifications.clear(STALE_NOTIFICATION_ID); } catch { /* yut */ }
});

async function initScrape(sessionId) {
  const st = {
    sessionId,
    status: "running",       // running | paused | aborted | done
    index: 0,
    startedAt: Date.now(),
    totals: { listings: 0, saved: 0, skipped: 0 },
    errors: [],
    scheduledNext: false,
  };
  await setState(st);
  await chrome.alarms.clear(STEP_ALARM);
  console.log(`[bg] scrape init ${sessionId} (${SAHIBINDEN_TARGETS.length} URL)`);
}

async function processNext() {
  if (processing) {
    console.log("[bg] processNext: zaten processing, skip");
    return;
  }
  processing = true;
  try {
    await _processNext();
  } finally {
    processing = false;
  }
}

async function _processNext() {
  const st = await getState();
  if (!st) return;
  if (st.status !== "running") {
    console.log(`[bg] processNext: status=${st.status}, skip`);
    return;
  }
  st.scheduledNext = false;
  await setState(st);

  if (st.index >= SAHIBINDEN_TARGETS.length) {
    console.log("[bg] tüm URL'ler bitti, finalize");
    st.status = "done";
    await setState(st);
    await finalize(st);
    return;
  }

  const target = SAHIBINDEN_TARGETS[st.index];
  const category = `${target.listing_type}/${target.property_type}`;
  console.log(`[bg] [${st.index + 1}/${SAHIBINDEN_TARGETS.length}] ${category}`);

  let result;
  try {
    result = await scrapeCategory(target, st.sessionId);
  } catch (err) {
    console.warn(`[bg] ${category} error:`, err.message);
    st.errors.push({ category, error: err.message });
    result = { parsed: 0, saved: 0, skipped: 0, captcha: false };
  }

  // State'i refresh et (paralel stop gelmiş olabilir)
  const st2 = await getState();
  if (!st2 || st2.status === "aborted") {
    console.log("[bg] aborted during scrape, exit");
    return;
  }
  st2.totals.listings += result.parsed || 0;
  st2.totals.saved += result.saved || 0;
  st2.totals.skipped += result.skipped || 0;

  if (result.loginRequired) {
    console.warn(`[bg] login required at ${category} (reason=${result.reason}) — paused`);
    await postJson("/login-required", {
      sessionId: st2.sessionId,
      url: target.url,
      category,
      reason: result.reason,
    });
    st2.status = "paused";
    await setState(st2);
    // Cookie state'i expired olarak işaretle + poller SET — kullanıcı
    // sahibinden açtığında otomatik resume (manuel /resume gerekmez)
    await setCookieState({
      ok: false,
      reason: `mid-scrape-${result.reason || "login-required"}`,
      lastCheck: Date.now(),
      expiredSince: Date.now(),
    });
    await schedulePollIfExpired();
    return;
  }

  if (result.captcha) {
    console.warn(`[bg] captcha at ${category} — paused`);
    await postJson("/captcha-detected", {
      sessionId: st2.sessionId,
      url: target.url,
      category,
    });
    st2.status = "paused";
    await setState(st2);
    return; // resume mesajı bekleniyor, alarm SET edilmiyor
  }

  // Sonraki URL var mı?
  st2.index += 1;
  if (st2.index >= SAHIBINDEN_TARGETS.length) {
    st2.status = "done";
    await setState(st2);
    await finalize(st2);
    return;
  }

  // Alarm ile 60sn sonra sıradakini tetikle (service worker suspend olsa bile)
  st2.scheduledNext = true;
  await setState(st2);
  // chrome.alarms periodInMinutes minimum 0.5 (30sn). delayInMinutes daha esnek.
  await chrome.alarms.create(STEP_ALARM, { delayInMinutes: TAB_INTERVAL_MS / 60000 });
  console.log(`[bg] next URL ${TAB_INTERVAL_MS / 1000}sn sonra (alarm SET)`);
}

async function finalize(st) {
  const duration = Date.now() - st.startedAt;
  await postJson("/scrape-done", {
    sessionId: st.sessionId,
    totalListings: st.totals.listings,
    totalSaved: st.totals.saved,
    totalSkipped: st.totals.skipped,
    duration,
    errors: st.errors,
  });
  await chrome.storage.local.set({
    lastStatus: st.status,
    lastFinish: Date.now(),
    lastTotals: {
      listings: st.totals.listings,
      saved: st.totals.saved,
      skipped: st.totals.skipped,
      errors: st.errors.length,
    },
  });
  await clearState();
  await chrome.alarms.clear(STEP_ALARM);
  console.log(`[bg] scrape ${st.status} — ${st.totals.saved}/${st.totals.listings} saved in ${(duration / 1000).toFixed(1)}s`);
}

// ─── Scrape One Category ─────────────────────────────────────────────────────

async function scrapeCategory(target, sessionId) {
  const tab = await chrome.tabs.create({ url: target.url, active: false });
  const tabId = tab.id;

  try {
    await waitForTabComplete(tabId);

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

    if (result.loginRequired) {
      return { parsed: 0, saved: 0, skipped: 0, captcha: false, loginRequired: true, reason: result.reason };
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
    try { await chrome.tabs.remove(tabId); } catch { /* zaten kapanmış */ }
  }
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        setTimeout(resolve, CONTENT_DOM_WAIT_MS);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
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

// Popup status query
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "get-status") {
    (async () => {
      const st = await getState();
      sendResponse({
        wsConnected: !!ws && ws.readyState === 1,
        session: st
          ? { id: st.sessionId, status: st.status, index: st.index, total: SAHIBINDEN_TARGETS.length, totals: st.totals }
          : null,
      });
    })();
    return true;
  }
});
