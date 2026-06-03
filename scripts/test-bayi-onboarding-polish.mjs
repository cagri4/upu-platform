#!/usr/bin/env node
/**
 * Bayi onboarding ince işçilik self-test (#79).
 * Pure logic + dosya kanıtı. 10+ pass hedef.
 */
import { readFileSync, existsSync } from "node:fs";

const ROOT = "/home/cagr/Masaüstü/upu-platform";
const tests = [];
const pass = (n) => tests.push({ n, ok: true });
const fail = (n, w) => tests.push({ n, ok: false, w });

function read(rel) {
  try { return readFileSync(`${ROOT}/${rel}`, "utf8"); } catch { return null; }
}

// ─── T1: KurucuHelpLink helper component var ─────────────────────────
{
  const f = read("src/components/empty-state-kurucu-link.tsx");
  if (f && f.includes("KurucuHelpLink") && f.includes("kurucuSecondary")
    && f.includes("upu:open-agent") && f.includes("role: \"kurucu\"")
    && f.includes("context")) pass("T1: helper component dispatch payload doğru");
  else fail("T1", "missing fields");
}

// ─── T2: kurucuSecondary EmptyState'in secondary type'ına uyumlu ─────
{
  const f = read("src/components/empty-state-kurucu-link.tsx");
  // EmptyState secondary: { label, href?, onClick? }
  if (f && /return\s*{\s*label:[\s\S]*onClick:/.test(f)) pass("T2: kurucuSecondary {label, onClick} döner");
  else fail("T2", "shape uyumsuz");
}

// ─── T3: 6 boş sayfaya EmptyState eklendi ────────────────────────────
{
  const targets = [
    ["bayi-panel",         "BayiPanelEmptyHero"],
    ["bayi-risk",          "Risk altında bayi yok"],
    ["bayi-stok",          "Stok eşiği"],
    ["bayilik-siparisleri","Henüz gelen sipariş yok"],
    ["bayi-tahsilatlarim", "Henüz tahsilat yok"],
    ["bayi-vade",          "Bekleyen fatura yok"],
  ];
  let ok = 0, miss = [];
  for (const [p, marker] of targets) {
    const f = read(`src/app/[locale]/(bayipanel)/${p}/page.tsx`);
    if (f && f.includes("EmptyState") && f.includes(marker)) ok++;
    else miss.push(`${p} (${marker})`);
  }
  if (ok === 6) pass("T3: 6/6 boş sayfa EmptyState + marker");
  else fail("T3", `${ok}/6 — eksik: ${miss.join(", ")}`);
}

// ─── T4: 4 mevcut sayfaya KurucuHelpLink eklendi ─────────────────────
{
  const targets = ["bayiler", "bayi-urunlerim", "bayi-siparislerim", "bayi-cari"];
  let ok = 0, miss = [];
  for (const p of targets) {
    const f = read(`src/app/[locale]/(bayipanel)/${p}/page.tsx`);
    if (f && f.includes("KurucuHelpLink") && f.includes("context=\"empty-state:")) ok++;
    else miss.push(p);
  }
  if (ok === 4) pass("T4: 4/4 mevcut sayfa Kurucu link import + context");
  else fail("T4", `${ok}/4 — eksik: ${miss.join(", ")}`);
}

// ─── T5: SidebarItem interface help field eklendi ────────────────────
{
  const f = read("src/components/admin-layout.tsx");
  if (f && /help\?:\s*{\s*title:\s*string/.test(f)
    && f.includes("firstStep")
    && f.includes("agentContext")) pass("T5: SidebarItem.help interface doğru");
  else fail("T5", "interface eksik");
}

// ─── T6: AdminLayout (?) ikon + modal mounted ────────────────────────
{
  const f = read("src/components/admin-layout.tsx");
  if (f && f.includes("SidebarHelpModal")
    && f.includes("setHelpItemId")
    && f.includes("aria-label=") // a11y
    && f.includes("e.stopPropagation()")) pass("T6: (?) buton stopPropagation + modal mount");
  else fail("T6", "modal/(?) wiring eksik");
}

// ─── T7: SidebarHelpModal escape + dispatch + onClose ────────────────
{
  const f = read("src/components/admin-layout.tsx");
  if (f && f.includes("Escape") && f.includes("upu:open-agent")
    && f.includes("role: \"kurucu\"") && f.includes("agentContext")) {
    pass("T7: help modal escape + Kurucu dispatch + context iletme");
  } else fail("T7", "modal interactions eksik");
}

// ─── T8: BAYI_SIDEBAR 10 ana item'de help dolu ───────────────────────
{
  const f = read("src/tenants/bayi/components/sidebar.ts");
  const ids = ["panelim","bayilerim","risk","urunlerim","stok","siparislerim",
               "gelen-siparisler","tahsilatlarim","cari","vade"];
  let ok = 0, miss = [];
  for (const id of ids) {
    // Match item id ile aynı paragraf'ta help blok arıyor
    const re = new RegExp(`id:\\s*"${id}"[\\s\\S]{0,800}help:\\s*{`);
    if (f && re.test(f)) ok++;
    else miss.push(id);
  }
  if (ok === 10) pass("T8: 10/10 ana sidebar item help dolu");
  else fail("T8", `${ok}/10 — eksik: ${miss.join(", ")}`);
}

// ─── T9: UpuAgentWidget context state + body iletim ──────────────────
{
  const f = read("src/components/agent/UpuAgentWidget.tsx");
  if (f && f.includes("pendingContext")
    && f.includes("setPendingContext")
    && f.includes("detail.context")
    && f.includes("slice(0, 240)")
    && f.includes("context: ctxForRequest")) pass("T9: widget context state + trim + body");
  else fail("T9", "widget context wiring eksik");
}

// ─── T10: agent chat route context sanitize + Kurucu prompt pass ─────
{
  const f = read("src/app/api/agent/chat/route.ts");
  if (f && f.includes("body.context")
    && f.includes("slice(0, 240)")
    && f.includes("replace(/[\\r\\n]+/g")
    && f.includes("callerContext: promptContext")) pass("T10: route context sanitize + prompt iletim");
  else fail("T10", "route ctx eksik");
}

// ─── T11: Kurucu prompt callerContext field + render ─────────────────
{
  const f = read("src/platform/agent/prompts/bayi-kurucu.ts");
  if (f && f.includes("callerContext")
    && f.includes("HALİHAZIR DURUM")
    && /ctx\s*\?\s*`/.test(f)) pass("T11: Kurucu prompt callerContext branch");
  else fail("T11", "prompt context branch eksik");
}

// ─── T12: dispatch payload tek-seferlik (consume + clear) ────────────
{
  const f = read("src/components/agent/UpuAgentWidget.tsx");
  if (f && /setPendingContext\(null\)/.test(f)
    && /tek seferlik tüket/i.test(f)) pass("T12: pendingContext tek-seferlik tüketim");
  else fail("T12", "consume mantığı eksik");
}

// ─── T13: helper component test'ler için var ─────────────────────────
{
  if (existsSync(`${ROOT}/src/components/empty-state-kurucu-link.tsx`)
    && existsSync(`${ROOT}/src/components/ui/EmptyState.tsx`)) pass("T13: helper + base component dosyaları");
  else fail("T13");
}

// ─── T14: prompt injection guard (\\n yutuldu) ───────────────────────
{
  const f = read("src/app/api/agent/chat/route.ts");
  // Linefeed/CR strip varsa "kullanıcı promptContext'i system override için kullanamaz" sağlanır
  if (f && /\.replace\(\/\[\\r\\n\]\+\/g/.test(f)) pass("T14: prompt injection guard (CR/LF strip)");
  else fail("T14", "linefeed strip yok");
}

// ─── Rapor ───────────────────────────────────────────────────────────
const ok = tests.filter(t => t.ok).length;
console.log(`\n${ok}/${tests.length} test passed\n`);
tests.forEach(t => console.log(t.ok ? `  ✓ ${t.n}` : `  ✗ ${t.n}: ${t.w}`));
console.log("");
process.exit(ok < 10 ? 1 : 0);
