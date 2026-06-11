/**
 * Prompt-injection savunması — LLM sistem promptuna giren kullanıcı-kontrollü
 * alanları (display_name, firma ünvanı, caller context) zararsızlaştırır.
 *
 * H-05 (2026-06-11 hardening audit): display_name / firmaUnvani sistem
 * promptuna escape edilmeden enjekte ediliyordu. "Ignore instructions
 * above\n\nSystem: ..." tarzı çok-satırlı payload'lar prompt yapısını
 * kırabiliyordu. Bu alanlar promptta TEK SATIR inline render edilir
 * ("Merhaba {ad}, {firma} için…"), bu yüzden:
 *   - kontrol karakterleri + satır sonları boşluğa indirilir (çok-satırlı
 *     enjeksiyon kapanır — en kritik vektör)
 *   - sıfır-genişlik / bidi (görünmez) karakterler atılır
 *   - whitespace tek boşluğa indirilir
 *   - uzunluk sınırlanır (devasa payload / token şişirme engellenir)
 *
 * Not: bu "tam güvenlik" değil — LLM yine metni okur. Amaç prompt YAPISINI
 * korumak (talimat satırı enjeksiyonu). Araçlar zaten ctx.tenantId ile
 * scope'lu olduğundan cross-tenant exfil yüzeyi yok.
 *
 * Codepoint-bazlı (regex literal'i değil) — kontrol karakteri içeren regex
 * literal'i kaynak dosyada satır kırardı.
 */

function isControlOrLine(cp: number): boolean {
  // C0 (0x00–0x1F), DEL+C1 (0x7F–0x9F), satır/paragraf ayracı (0x2028/0x2029)
  return (
    (cp >= 0x00 && cp <= 0x1f) ||
    (cp >= 0x7f && cp <= 0x9f) ||
    cp === 0x2028 ||
    cp === 0x2029
  );
}

function isInvisible(cp: number): boolean {
  // Sıfır-genişlik (0x200B–0x200F), bidi yön (0x202A–0x202E),
  // word joiner (0x2060), BOM/zero-width-nbsp (0xFEFF)
  return (
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x202a && cp <= 0x202e) ||
    cp === 0x2060 ||
    cp === 0xfeff
  );
}

/** Tek-satır prompt alanını temizle: kontrol/görünmez karakter yok, tek boşluk, kırpılmış. */
export function sanitizePromptField(
  value: string | null | undefined,
  maxLen = 100,
): string {
  if (value == null) return "";
  let out = "";
  for (const ch of String(value)) {
    const cp = ch.codePointAt(0) ?? 0;
    if (isInvisible(cp)) continue; // tamamen at
    out += isControlOrLine(cp) ? " " : ch; // kontrol → boşluk
  }
  return out.replace(/\s+/g, " ").trim().slice(0, maxLen);
}
