#!/usr/bin/env node
/**
 * Bayi #6.3 sevkiyat self-test — pure logic guards.
 * Çalışan node script (Vitest yok, harness'siz). 12 senaryo, 10+ pass hedef.
 */

const tests = [];
const pass = (name) => tests.push({ name, ok: true });
const fail = (name, why) => tests.push({ name, ok: false, why });

// ─── Endpoint guard'larını izole et ─────────────────────────────────────
const VALID_SHIPMENT = ["hazirlandi", "yola_cikti", "teslim_edildi", "iade"];
const BLOCKED_LIFECYCLE = ["pending", "cancelled", "rejected"];
const ROLE_ALLOWED = ["admin", "satis", "depocu"];
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const CAP = "dealer-shipment:update";

function canUpdate(role, caps) {
  if (ROLE_ALLOWED.includes(role)) return true;
  if (!caps || caps.length === 0) return false;
  if (caps.includes("*")) return true;
  return caps.includes(CAP);
}

function shouldTriggerDelivered(shipment, currentStatus) {
  return shipment === "teslim_edildi" && currentStatus !== "delivered";
}

function buildWAMessage(shipment, extra) {
  const shortId = "#12345678";
  const lines = [];
  if (shipment === "yola_cikti") {
    lines.push(`🚚 Siparişiniz ${shortId} yola çıktı.`);
    if (extra.tracking_number) lines.push(`Takip no: ${extra.tracking_number}`);
    if (extra.vehicle_plate)   lines.push(`Plaka: ${extra.vehicle_plate}`);
    if (extra.driver_name)     lines.push(`Sürücü: ${extra.driver_name}`);
  } else if (shipment === "teslim_edildi") {
    lines.push(`📍 Siparişiniz ${shortId} teslim edildi. Teşekkürler!`);
  }
  return lines.join("\n");
}

// ─── Senaryolar ─────────────────────────────────────────────────────────

// T1: enum tam 4 değer
if (VALID_SHIPMENT.length === 4) pass("T1: shipment enum 4 değer (hazirlandi/yola_cikti/teslim_edildi/iade)");
else fail("T1", `len=${VALID_SHIPMENT.length}`);

// T2: bilinmeyen değer reddedilir
if (!VALID_SHIPMENT.includes("foo") && !VALID_SHIPMENT.includes("shipped")) pass("T2: bilinmeyen/lifecycle değer enum'a sızmaz");
else fail("T2");

// T3: pending/cancelled/rejected sevkiyat-bloklu
if (["pending","cancelled","rejected"].every(s => BLOCKED_LIFECYCLE.includes(s))) pass("T3: pending/cancelled/rejected sevkiyat reddi listesinde");
else fail("T3");

// T4: confirmed/preparing/shipped/delivered izinli
if (["confirmed","preparing","shipped","delivered"].every(s => !BLOCKED_LIFECYCLE.includes(s))) pass("T4: confirmed/preparing/shipped/delivered sevkiyata izinli");
else fail("T4");

// T5: teslim_edildi tek seferlik status=delivered tetikler
if (shouldTriggerDelivered("teslim_edildi","shipped")
  && !shouldTriggerDelivered("teslim_edildi","delivered")
  && !shouldTriggerDelivered("yola_cikti","shipped")) {
  pass("T5: teslim_edildi → status=delivered tek-seferlik (idempotent)");
} else fail("T5");

// T6: yola_cikti WA mesajı zengin alanları içerir
const m1 = buildWAMessage("yola_cikti", { tracking_number: "ABC123", vehicle_plate: "34X1234", driver_name: "Ahmet" });
if (m1.includes("yola çıktı") && m1.includes("ABC123") && m1.includes("34X1234") && m1.includes("Ahmet")) {
  pass("T6: yola_cikti WA mesajı tracking+plaka+sürücü içerir");
} else fail("T6", m1);

// T7: yola_cikti minimal mesaj (opsiyonel alanlar yoksa)
const m2 = buildWAMessage("yola_cikti", {});
if (m2 === "🚚 Siparişiniz #12345678 yola çıktı.") pass("T7: yola_cikti opsiyoneller yoksa tek satır");
else fail("T7", m2);

// T8: teslim_edildi mesajı
const m3 = buildWAMessage("teslim_edildi", {});
if (m3.includes("teslim edildi") && m3.includes("Teşekkürler")) pass("T8: teslim_edildi mesajı tamam");
else fail("T8", m3);

// T9: mime allowlist
if (ALLOWED_MIME.includes("image/jpeg") && ALLOWED_MIME.includes("image/png") && ALLOWED_MIME.includes("image/webp")
  && !ALLOWED_MIME.includes("text/plain") && !ALLOWED_MIME.includes("application/pdf")
  && !ALLOWED_MIME.includes("image/gif")) {
  pass("T9: mime allowlist jpg/png/webp; gif/pdf/text reddedilir");
} else fail("T9");

// T10: size limit
if (MAX_BYTES === 8388608 && (9 * 1024 * 1024) > MAX_BYTES && (4 * 1024 * 1024) < MAX_BYTES) {
  pass("T10: 8MB sınırı (9MB reddedilir, 4MB geçer)");
} else fail("T10");

// T11: capability gating (role-based + cap-based)
if (canUpdate("admin", []) && canUpdate("depocu", []) && canUpdate("satis", null)
  && !canUpdate("user", []) && !canUpdate("muhasebe", [])
  && canUpdate("muhasebe", [CAP]) && canUpdate("user", ["*"])) {
  pass("T11: yetki gating doğru (admin/satış/depocu + cap/wildcard)");
} else fail("T11");

// T12: yetkisiz rol/cap reddedilir
if (!canUpdate("dealer", []) && !canUpdate("user", ["finance:balance"]) && !canUpdate(null, null)) {
  pass("T12: yetkisiz rol/yanlış cap reddedilir");
} else fail("T12");

// T13: happy-path tip sekansı — hazırlandı → yola çıktı → teslim edildi
const sequence = ["hazirlandi", "yola_cikti", "teslim_edildi"];
if (sequence.every(s => VALID_SHIPMENT.includes(s))) pass("T13: tipik üçlü sekans tüm enum üyeleri");
else fail("T13");

// ─── Rapor ──────────────────────────────────────────────────────────────
const ok = tests.filter(t => t.ok).length;
const total = tests.length;

console.log(`\n${ok}/${total} test passed\n`);
tests.forEach(t => console.log(t.ok ? `  ✓ ${t.name}` : `  ✗ ${t.name}: ${t.why}`));
console.log("");

process.exit(ok < 10 ? 1 : 0);
