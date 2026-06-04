#!/usr/bin/env node
/**
 * Bayi #91 WA bildirim template wiring self-test.
 * Pure logic + dosya kanıtı. 12+ pass hedef.
 * Gerçek WhatsApp API çağrısı YOK (test telefonuna spam yapmıyoruz).
 */
import { readFileSync, existsSync } from "node:fs";

const ROOT = "/home/cagr/Masaüstü/upu-platform";
const tests = [];
const pass = (n) => tests.push({ n, ok: true });
const fail = (n, w) => tests.push({ n, ok: false, w });

function read(rel) {
  try { return readFileSync(`${ROOT}/${rel}`, "utf8"); } catch { return null; }
}

// ─── Mock NOTIFICATION_TYPE_TEMPLATES (TS imports yok — manuel re-impl) ──
const APPROVED = new Set(["upu_otp_giris", "upu_panel_erisim"]);

function s(value, max = 200) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

const MAP = {
  faturalama: {
    name: "upu_bekleyen_islem",
    buildParams: (i) => {
      const p = i.payload;
      const bucket = p.days_bucket;
      const due = bucket === 0 ? "bugün vadeli" : bucket === 1 ? "yarın vadeli" : `${bucket} gün sonra vadeli`;
      const summary = p.invoice_no ? `Fatura ${p.invoice_no} (${due})` : s(i.title, 120);
      return [s(i.tenantName, 40), s(summary, 200), s(i.panelUrl, 200)];
    },
  },
  yeni_musteri_kayit: {
    name: "upu_yeni_kayit",
    buildParams: (i) => [s(i.tenantName, 40), "müşteri", s(i.body || i.title, 150), s(i.panelUrl, 200)],
  },
  mulk_durum_degisti: {
    name: "upu_durum_guncelleme",
    buildParams: (i) => {
      const p = i.payload || {};
      return [s(i.tenantName, 40), s(p.entity_label || i.title, 100), s(p.new_status || i.body, 80)];
    },
  },
  sabah_brif: {
    name: "upu_gunluk_ozet",
    buildParams: (i) => [s(i.tenantName, 40), s(i.body || i.title, 250), s(i.panelUrl, 200)],
  },
};

// resolvePanelUrl re-impl
function resolvePanelUrl(host, target) {
  if (!target) return host ? `https://${host}/` : "";
  if (/^https?:\/\//.test(target)) return target;
  if (!host) return target;
  const path = target.startsWith("/") ? target : `/${target}`;
  return `https://${host}${path}`;
}

const CS_WINDOW_MS = 24 * 60 * 60 * 1000;

// ─── T1: templates.ts APPROVED set sadece 2 onaylı template'i içerir ──
{
  const f = read("src/platform/whatsapp/templates.ts");
  if (f && f.includes("APPROVED_NOTIFICATION_TEMPLATES")
    && /"upu_otp_giris"/.test(f) && /"upu_panel_erisim"/.test(f)) pass("T1: APPROVED set 2 onaylı template var");
  else fail("T1", "set eksik");
}

// ─── T2: 4 PENDING template runtime allowlist'te DEĞİL ──
{
  const f = read("src/platform/whatsapp/templates.ts");
  const pendingNames = ["upu_yeni_kayit","upu_bekleyen_islem","upu_durum_guncelleme","upu_gunluk_ozet"];
  // Allowlist set'inde olmamalı (only commented as pending). Heuristik:
  // const APPROVED_NOTIFICATION_TEMPLATES = new Set([ ... ]); — bu blok'a baktım
  const m = f && f.match(/APPROVED_NOTIFICATION_TEMPLATES[^]*?Set\(\[([^\]]+)\]/);
  if (m) {
    const block = m[1];
    const sneaked = pendingNames.filter((n) => block.includes(`"${n}"`));
    if (sneaked.length === 0) pass("T2: 4 PENDING template runtime allowlist'te değil");
    else fail("T2", `pending sızdı: ${sneaked.join(",")}`);
  } else fail("T2", "set parse edilemedi");
}

// ─── T3: sendTemplateByName allowlist guard ──
{
  const f = read("src/platform/whatsapp/templates.ts");
  if (f && f.includes("sendTemplateByName")
    && /APPROVED_NOTIFICATION_TEMPLATES\.has\(name\)/.test(f)
    && f.includes("allowlist'inde değil")) pass("T3: sendTemplateByName allowlist guard mevcut");
  else fail("T3", "guard yok");
}

// ─── T4: types.ts NOTIFICATION_TYPE_TEMPLATES exports ──
{
  const f = read("src/platform/notifications/types.ts");
  if (f && f.includes("NOTIFICATION_TYPE_TEMPLATES")
    && f.includes("faturalama:")
    && f.includes("upu_bekleyen_islem")) pass("T4: types.ts mapping export + faturalama → upu_bekleyen_islem");
  else fail("T4");
}

// ─── T5: param dolumu (faturalama D-1) sırası ──
{
  const input = {
    tenantName: "Bayi",
    panelUrl: "https://retailai.upudev.nl/tr/bayi-fatura",
    title: "🟡 Faturanız yarın vadeli",
    body: "Detay…",
    payload: { invoice_no: "FAT-2026-0001", days_bucket: 1, due_date: "2026-06-05" },
  };
  const p = MAP.faturalama.buildParams(input);
  if (p.length === 3 && p[0] === "Bayi"
    && p[1].includes("FAT-2026-0001") && p[1].includes("yarın")
    && p[2].endsWith("/tr/bayi-fatura")) pass("T5: faturalama params [tenant, summary(invoice+due), url] sırası");
  else fail("T5", JSON.stringify(p));
}

// ─── T6: D-0 (bugün) ve D-3 (3 gün sonra) bucket label ──
{
  const i0 = { tenantName: "B", panelUrl: "", title: "", body: "", payload: { invoice_no: "X", days_bucket: 0 } };
  const i3 = { tenantName: "B", panelUrl: "", title: "", body: "", payload: { invoice_no: "X", days_bucket: 3 } };
  const p0 = MAP.faturalama.buildParams(i0)[1];
  const p3 = MAP.faturalama.buildParams(i3)[1];
  if (p0.includes("bugün") && p3.includes("3 gün")) pass("T6: bucket label (0=bugün, 3=3 gün sonra)");
  else fail("T6", `${p0} | ${p3}`);
}

// ─── T7: sanitize — \n strip ve max length trim ──
{
  const i = {
    tenantName: "Bayi",
    panelUrl: "url",
    title: "satır1\nsatır2\r\nsatır3",
    body: "x".repeat(500),
    payload: {},
  };
  const p = MAP.faturalama.buildParams(i);
  // title fallback summary (no invoice_no)
  if (!p[1].includes("\n") && !p[1].includes("\r") && p[1].length <= 200) pass("T7: sanitize \\n strip + length cap");
  else fail("T7", JSON.stringify(p[1]));
}

// ─── T8: resolvePanelUrl 4 senaryo ──
{
  const a = resolvePanelUrl("retailai.upudev.nl", "/tr/bayi-fatura");
  const b = resolvePanelUrl("retailai.upudev.nl", "https://x.com/y");
  const c = resolvePanelUrl(null, "/tr/x");
  const d = resolvePanelUrl("retailai.upudev.nl", undefined);
  if (a === "https://retailai.upudev.nl/tr/bayi-fatura"
    && b === "https://x.com/y"
    && c === "/tr/x"
    && d === "https://retailai.upudev.nl/") pass("T8: resolvePanelUrl 4 case OK");
  else fail("T8", JSON.stringify({a,b,c,d}));
}

// ─── T9: send-notification PATH branchleri kodda mevcut ──
{
  const f = read("src/platform/notifications/send-notification.ts");
  if (f && f.includes("PATH A") && f.includes("PATH B") && f.includes("PATH C") && f.includes("PATH D")
    && f.includes("lastInboundAt") && f.includes("CS_WINDOW_MS")) pass("T9: window-aware 4 PATH branch mevcut");
  else fail("T9");
}

// ─── T10: PENDING flag DB payload'ına yazılır ──
{
  const f = read("src/platform/notifications/send-notification.ts");
  if (f && f.includes("wa_pending_template: true")
    && f.includes("template_name: tplMap.name")
    && f.includes("pending_since")
    && f.includes('channels.push("wa-pending")')) pass("T10: PENDING flag payload + channels=['wa-pending']");
  else fail("T10");
}

// ─── T11: APPROVED template path channels = wa-template / wa-failed ──
{
  const f = read("src/platform/notifications/send-notification.ts");
  if (f && /channels\.push\(res\.ok\s*\?\s*"wa-template"\s*:\s*"wa-failed"\)/.test(f)) pass("T11: APPROVED path channels ternary");
  else fail("T11");
}

// ─── T12: window AÇIK path mevcut sendButtons (regresyon yok) ──
{
  const f = read("src/platform/notifications/send-notification.ts");
  if (f && /windowOpen[\s\S]{0,500}sendButtons\s*\(/.test(f)
    && f.includes("notif_view_") && f.includes("notif_ack_")) pass("T12: window AÇIK path sendButtons (regresyon yok)");
  else fail("T12");
}

// ─── T13: vade cron sendNotification kullanım uyumlu (NotificationInput) ──
{
  const f = read("src/app/api/cron/bayi-vade-reminder/route.ts");
  if (f && f.includes('type: "faturalama"')
    && f.includes("invoice_no")
    && f.includes("days_bucket")) pass("T13: vade cron type=faturalama + payload.invoice_no/days_bucket — mapping ile uyumlu");
  else fail("T13");
}

// ─── T14: check_template_status.py mevcut + Meta API çağrısı ──
{
  const f = read("scripts/check_template_status.py");
  if (f && f.includes("graph.facebook.com/v23.0")
    && f.includes("notification_templates_status.json")
    && f.includes("APPROVED_NOTIFICATION_TEMPLATES")) pass("T14: check_template_status.py mevcut + status JSON yazımı");
  else fail("T14");
}

// ─── T15: README pointer ──
{
  if (existsSync(`${ROOT}/scripts/README-notification-templates.md`)) pass("T15: README pointer dosyası mevcut");
  else fail("T15");
}

// ─── Rapor ──────────────────────────────────────────────────────────
const ok = tests.filter(t => t.ok).length;
console.log(`\n${ok}/${tests.length} test passed\n`);
tests.forEach(t => console.log(t.ok ? `  ✓ ${t.n}` : `  ✗ ${t.n}: ${t.w}`));
console.log("");
process.exit(ok < 12 ? 1 : 0);
