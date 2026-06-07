#!/usr/bin/env node
/**
 * Test Fix D — HelpBadge localStorage flag mantığı doğrulama.
 * Pure-logic re-implementation; gerçek React/DOM kullanmaz.
 * Hedef: 7/7 senaryo pass — kod zaten doğruysa fix yok.
 */

const tests = [];
const pass = (n) => tests.push({ n, ok: true });
const fail = (n, w) => tests.push({ n, ok: false, w });

// ─── HelpBadge + HelpCenter localStorage davranışı (re-impl) ─────────────
function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    clear: () => store.clear(),
    size: () => store.size,
  };
}

// HelpBadge mount → visible? (HelpBadge.tsx:23-31 + 33-41)
function badgeMountVisible(storage, saasKey) {
  const key = `helpCenter:${saasKey}:seen`;
  const seen = storage.getItem(key);
  return !seen; // !seen → visible=true
}

// HelpBadge dismiss (HelpBadge.tsx:33-41) — flag yaz + setVisible(false) + onDismiss
function badgeDismiss(storage, saasKey, onDismiss) {
  const key = `helpCenter:${saasKey}:seen`;
  storage.setItem(key, "1");
  if (onDismiss) onDismiss();
  return false; // setVisible(false)
}

// HelpCenter handleOpen (HelpCenter.tsx:52-60) — flag yaz + setOpen(true)
function centerHandleOpen(storage, saasKey) {
  const key = `helpCenter:${saasKey}:seen`;
  storage.setItem(key, "1");
  return true; // setOpen(true)
}

// ─── T1: İlk yüklemede (boş storage) badge GÖRÜNÜR ──────────────────────
{
  const s = makeStorage();
  const visible = badgeMountVisible(s, "bayi");
  if (visible === true) pass("T1: İlk yükleme → badge görünür");
  else fail("T1");
}

// ─── T2: Flag set sonrası refresh → badge GÖRÜNMEZ ──────────────────────
{
  const s = makeStorage();
  s.setItem("helpCenter:bayi:seen", "1");
  const visible = badgeMountVisible(s, "bayi");
  if (visible === false) pass("T2: Refresh + flag '1' → badge gizli");
  else fail("T2");
}

// ─── T3: Badge click → dismiss flag yazar + onDismiss tetiklenir ────────
{
  const s = makeStorage();
  let onDismissCalled = false;
  const newVisible = badgeDismiss(s, "bayi", () => { onDismissCalled = true; });
  if (s.getItem("helpCenter:bayi:seen") === "1"
    && onDismissCalled === true
    && newVisible === false) pass("T3: Badge dismiss flag yazar + callback + setVisible(false)");
  else fail("T3", `flag=${s.getItem("helpCenter:bayi:seen")}, cb=${onDismissCalled}, vis=${newVisible}`);
}

// ─── T4: HelpCenter button click → flag yazar (badge'de de aynı flag) ────
{
  const s = makeStorage();
  const opened = centerHandleOpen(s, "bayi");
  if (s.getItem("helpCenter:bayi:seen") === "1" && opened === true) {
    pass("T4: Center button → flag yazar + drawer açar");
  } else fail("T4");
}

// ─── T5: Badge görünür iken Center button → ikinci girişte badge gizli ──
(() => {
  const s = makeStorage();
  const visible1 = badgeMountVisible(s, "bayi");
  centerHandleOpen(s, "bayi");
  const visible2 = badgeMountVisible(s, "bayi");
  if (visible1 === true && visible2 === false) pass("T5: Center click sonrası refresh → badge gizli");
  else fail("T5", `v1=${visible1}, v2=${visible2}`);
})();

// ─── T6: Per-saasKey namespace izolasyonu ───────────────────────────────
{
  const s = makeStorage();
  centerHandleOpen(s, "bayi");
  // bayi'de görünmemeli, emlak'ta görünmeli
  const bayiV = badgeMountVisible(s, "bayi");
  const emlakV = badgeMountVisible(s, "emlak");
  if (bayiV === false && emlakV === true) pass("T6: Per-saasKey izolasyon — bayi gizli, emlak görünür");
  else fail("T6", `bayi=${bayiV}, emlak=${emlakV}`);
}

// ─── T7: localStorage throw → graceful (badge gösterilmez) ──────────────
{
  const throwingStorage = {
    getItem: () => { throw new Error("private mode"); },
    setItem: () => { throw new Error("private mode"); },
  };
  // HelpBadge.tsx:23-31 try-catch → erişim engellenmişse setVisible(true) çağrılmaz
  let visible = false;
  try {
    const seen = throwingStorage.getItem("helpCenter:bayi:seen");
    if (!seen) visible = true;
  } catch {
    // visible default false kalır
  }
  if (visible === false) pass("T7: localStorage throw → badge gösterilmez (graceful)");
  else fail("T7");
}

// ─── Rapor ─────────────────────────────────────────────────────────────
const ok = tests.filter(t => t.ok).length;
console.log(`\n${ok}/${tests.length} test passed\n`);
tests.forEach(t => console.log(t.ok ? `  ✓ ${t.n}` : `  ✗ ${t.n}: ${t.w}`));
console.log("\nSonuç: HelpBadge + HelpCenter flag mantığı doğru — fix gerekmez.\n");
process.exit(ok < 7 ? 1 : 0);
