/**
 * Toplu içe aktarım — basit, esnek CSV/TSV/space-delimited parser.
 *
 * "Kopyala-yapıştır" desteği için: Excel/Sheets'ten kopyalanan metin
 * TAB-delimited gelir; CSV virgüllü; bazen noktalı virgül. Bu helper
 * üçünü de algılar.
 *
 * Header satırı VARSAYILIR — bayi için bilinen alias'larla sütun isimleri
 * sistem alanlarına eşlenir. Eşleşmeyen kolonlar skip.
 */

export type ParsedRow = Record<string, string | number | null>;

export interface ParseResult<T> {
  rows: T[];
  skipped: Array<{ row_index: number; reason: string; raw?: string }>;
  detected_delimiter: string;
  header_map: Record<string, string>;  // input_col → mapped_field
  unmapped_columns: string[];
}

const DELIMITER_CANDIDATES = ["\t", ";", ","] as const;

function detectDelimiter(firstLine: string): string {
  let best = ",";
  let bestCount = 0;
  for (const d of DELIMITER_CANDIDATES) {
    const c = firstLine.split(d).length;
    if (c > bestCount) { bestCount = c; best = d; }
  }
  return best;
}

function splitLine(line: string, delim: string): string[] {
  // Basit CSV — quoted fields için minimal destek (escaping yok).
  if (delim === ",") {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  }
  return line.split(delim).map(s => s.trim().replace(/^"|"$/g, ""));
}

function norm(s: string): string {
  return s.toLowerCase()
    .replace(/[ğ]/g, "g").replace(/[ü]/g, "u").replace(/[ş]/g, "s")
    .replace(/[ı]/g, "i").replace(/[ö]/g, "o").replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

// ─── Dealer alias mapping ────────────────────────────────────────────
const DEALER_ALIASES: Record<string, string[]> = {
  name:           ["ad", "isim", "name", "bayiadi", "firmaadi", "unvan", "bayi", "firma"],
  phone:          ["tel", "telefon", "phone", "mobil", "gsm", "iletisim"],
  contact_name:   ["yetkili", "iletisimkisi", "contact", "yetkiliadi", "kisi"],
  city:           ["sehir", "il", "city"],
  district:       ["ilce", "district"],
  email:          ["email", "eposta", "mail"],
  address_line:   ["adres", "address", "addressline", "adresi"],
  tax_number:     ["vergino", "taxno", "tcno", "vkn"],
  credit_limit:   ["kredilimit", "creditlimit", "limit"],
  payment_term_days: ["vadegun", "vadegunu", "vade", "paymentterm"],
};

const PRODUCT_ALIASES: Record<string, string[]> = {
  name:           ["urunadi", "urun", "ad", "isim", "name"],
  code:           ["kod", "stokkodu", "code", "sku", "barkod"],
  unit_price:     ["fiyat", "birimfiyat", "satisfiyati", "price", "unitprice"],
  category:       ["kategori", "category", "grup"],
  brand:          ["marka", "brand"],
  unit:           ["birim", "unit"],
  stock_quantity: ["stok", "stokmiktari", "stoksay", "stoksayisi", "stockquantity", "miktar", "adet"],
  description:    ["aciklama", "description", "tanim"],
};

function buildHeaderMap(headers: string[], aliases: Record<string, string[]>): { map: Record<string, string>; unmapped: string[] } {
  const map: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const h of headers) {
    const n = norm(h);
    let matched: string | null = null;
    for (const [field, alts] of Object.entries(aliases)) {
      if (alts.some(a => a === n)) { matched = field; break; }
    }
    if (matched) map[h] = matched;
    else unmapped.push(h);
  }
  return { map, unmapped };
}

// ─── Dealer parse ────────────────────────────────────────────────────
export interface DealerRow {
  name: string;
  phone: string;
  contact_name?: string | null;
  city?: string | null;
  district?: string | null;
  email?: string | null;
  address_line?: string | null;
  tax_number?: string | null;
  credit_limit?: number | null;
  payment_term_days?: number | null;
}

export function parseDealersText(text: string): ParseResult<DealerRow> {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return { rows: [], skipped: [], detected_delimiter: ",", header_map: {}, unmapped_columns: [] };
  }
  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim);
  const { map, unmapped } = buildHeaderMap(headers, DEALER_ALIASES);

  const rows: DealerRow[] = [];
  const skipped: ParseResult<DealerRow>["skipped"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], delim);
    const r: ParsedRow = {};
    for (let c = 0; c < headers.length; c++) {
      const field = map[headers[c]];
      if (!field) continue;
      const val = cols[c]?.trim();
      if (val === undefined || val === "") continue;
      if (field === "credit_limit" || field === "payment_term_days") {
        const n = parseFloat(val.replace(/[^\d.,-]/g, "").replace(",", "."));
        r[field] = isFinite(n) ? n : null;
      } else {
        r[field] = val;
      }
    }
    if (!r.name || !r.phone) {
      skipped.push({ row_index: i + 1, reason: !r.name ? "İsim boş" : "Telefon boş", raw: lines[i].slice(0, 80) });
      continue;
    }
    rows.push(r as unknown as DealerRow);
  }
  return { rows, skipped, detected_delimiter: delim, header_map: map, unmapped_columns: unmapped };
}

// ─── Product parse ───────────────────────────────────────────────────
export interface ProductRow {
  name: string;
  code?: string | null;
  unit_price: number;
  category?: string | null;
  brand?: string | null;
  unit?: string | null;
  stock_quantity?: number | null;
  description?: string | null;
}

export function parseProductsText(text: string): ParseResult<ProductRow> {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.length > 0);
  if (lines.length < 2) {
    return { rows: [], skipped: [], detected_delimiter: ",", header_map: {}, unmapped_columns: [] };
  }
  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim);
  const { map, unmapped } = buildHeaderMap(headers, PRODUCT_ALIASES);

  const rows: ProductRow[] = [];
  const skipped: ParseResult<ProductRow>["skipped"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], delim);
    const r: ParsedRow = {};
    for (let c = 0; c < headers.length; c++) {
      const field = map[headers[c]];
      if (!field) continue;
      const val = cols[c]?.trim();
      if (val === undefined || val === "") continue;
      if (field === "unit_price") {
        // Sayı format heuristik:
        //   "1.250,50" (TR thousand+decimal) → 1250.50
        //   "1,250.50" (US thousand+decimal) → 1250.50
        //   "89,90"    (TR decimal only)    → 89.90
        //   "89.90"    (US decimal only)    → 89.90
        //   "1250"     → 1250
        const cleaned = val.replace(/[^\d.,-]/g, "");
        const hasDot = cleaned.includes(".");
        const hasComma = cleaned.includes(",");
        let normalized: string;
        if (hasDot && hasComma) {
          // Hangi son geliyorsa o decimal sayılır
          const lastDot = cleaned.lastIndexOf(".");
          const lastComma = cleaned.lastIndexOf(",");
          if (lastComma > lastDot) {
            // TR: "1.250,50"
            normalized = cleaned.replace(/\./g, "").replace(",", ".");
          } else {
            // US: "1,250.50"
            normalized = cleaned.replace(/,/g, "");
          }
        } else if (hasComma) {
          // Sadece virgül → TR decimal
          normalized = cleaned.replace(",", ".");
        } else {
          // Sadece nokta veya hiç → olduğu gibi (parseFloat US sayar)
          normalized = cleaned;
        }
        const n = parseFloat(normalized);
        r[field] = isFinite(n) ? n : null;
      } else if (field === "stock_quantity") {
        const n = parseInt(val.replace(/[^\d]/g, ""), 10);
        r[field] = isFinite(n) ? n : null;
      } else {
        r[field] = val;
      }
    }
    if (!r.name) {
      skipped.push({ row_index: i + 1, reason: "Ürün adı boş", raw: lines[i].slice(0, 80) });
      continue;
    }
    if (r.unit_price === null || r.unit_price === undefined) {
      skipped.push({ row_index: i + 1, reason: "Fiyat boş veya geçersiz", raw: lines[i].slice(0, 80) });
      continue;
    }
    rows.push(r as unknown as ProductRow);
  }
  return { rows, skipped, detected_delimiter: delim, header_map: map, unmapped_columns: unmapped };
}
