/**
 * Bayi — Toplu Ürün Yükleme (CSV/Excel)
 *
 * Magic-link tabanlı, 3 ekran flow:
 *   1. select   — şablon indir + dosya yükle (CSV veya Excel)
 *   2. preview  — ilk 10 satır + alan eşleştirme + hata vurgu
 *   3. result   — başarılı/hatalı sayım + hata listesi indir
 *
 * Excel parse için xlsx (SheetJS) CDN üzerinden lazy-load edilir;
 * npm dep eklemiyoruz (CSP allow + browser cache yeterli).
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Screen = "init" | "select" | "preview" | "saving" | "result";

interface RawRow {
  __row: number;
  __raw: Record<string, string>;
}

interface NormalizedRow extends RawRow {
  name: string;
  category: string;
  brand: string;
  base_price: number;
  stock_quantity: number;
  unit: string;
  sku: string;
  barcode: string;
  description: string;
  min_order: number;
  weight: number;
  image_url: string;
  __valid: boolean;
  __issues: string[];
}

const FIELD_ALIASES: Record<string, string> = {
  // name
  "ad": "name", "name": "name", "urun": "name", "ürün": "name", "urun_adi": "name", "ürün adı": "name", "ürün_adı": "name",
  // category
  "kategori": "category", "category": "category", "grup": "category",
  // brand
  "marka": "brand", "brand": "brand",
  // price
  "fiyat": "base_price", "price": "base_price", "birim_fiyat": "base_price", "birim fiyat": "base_price",
  // stock
  "stok": "stock_quantity", "stock": "stock_quantity", "miktar": "stock_quantity",
  // unit
  "birim": "unit", "unit": "unit",
  // sku
  "sku": "sku", "kod": "sku", "urun_kodu": "sku", "ürün kodu": "sku",
  // barcode
  "barkod": "barcode", "barcode": "barcode", "ean": "barcode",
  // description
  "aciklama": "description", "açıklama": "description", "description": "description", "detay": "description",
  // min order
  "min_siparis": "min_order", "min sipariş": "min_order", "min_order": "min_order", "minimum": "min_order",
  // weight
  "agirlik": "weight", "ağırlık": "weight", "weight": "weight", "kg": "weight",
  // image
  "gorsel": "image_url", "görsel": "image_url", "image": "image_url", "image_url": "image_url", "resim": "image_url", "url": "image_url",
};

function detectSeparator(line: string): string {
  const semi = (line.match(/;/g) || []).length;
  const tab = (line.match(/\t/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  if (tab > 0 && tab >= comma && tab >= semi) return "\t";
  if (semi > comma) return ";";
  return ",";
}

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 1) return { headers: [], rows: [] };
  const sep = detectSeparator(lines[0]);
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
  if (arr.length < 1) return { headers: [], rows: [] };
  const headers = arr[0].map(h => String(h).trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < arr.length; i++) {
    const cells = arr[i] || [];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = String(cells[idx] ?? "").trim(); });
    if (Object.values(row).some(v => v.length > 0)) rows.push(row);
  }
  return { headers, rows };
}

declare global {
  interface Window { XLSX?: unknown }
}

async function loadXlsx(): Promise<{ read: (data: ArrayBuffer | Uint8Array, opts: { type: string }) => { Sheets: Record<string, unknown>; SheetNames: string[] }; utils: { sheet_to_json: (ws: unknown, opts: { header: 1; defval: string }) => unknown[] } }> {
  if (typeof window !== "undefined" && window.XLSX) return window.XLSX as ReturnType<typeof loadXlsx> extends Promise<infer T> ? T : never;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("xlsx kütüphanesi yüklenemedi"));
    document.head.appendChild(script);
  });
  return window.XLSX as ReturnType<typeof loadXlsx> extends Promise<infer T> ? T : never;
}

function normalizeRows(headers: string[], raw: Record<string, string>[]): NormalizedRow[] {
  // headers → field map
  const fieldMap: Record<string, string> = {};
  headers.forEach(h => {
    const f = FIELD_ALIASES[h];
    if (f) fieldMap[h] = f;
  });

  const out: NormalizedRow[] = [];
  raw.forEach((r, idx) => {
    const norm: Partial<NormalizedRow> = {
      __row: idx + 2,
      __raw: r,
      __issues: [],
      __valid: true,
    };
    for (const h of headers) {
      const field = fieldMap[h];
      if (!field) continue;
      const v = r[h];
      if (field === "base_price" || field === "stock_quantity" || field === "min_order" || field === "weight") {
        const n = Number(String(v).replace(",", ".").trim());
        (norm as Record<string, unknown>)[field] = Number.isFinite(n) ? n : 0;
      } else {
        (norm as Record<string, unknown>)[field] = v?.trim() ?? "";
      }
    }
    // Validation
    const issues: string[] = [];
    if (!norm.name || norm.name.length < 2) issues.push("Ürün adı eksik veya çok kısa");
    if (!norm.base_price || norm.base_price <= 0) issues.push("Fiyat geçersiz veya sıfır");
    norm.__issues = issues;
    norm.__valid = issues.length === 0;
    out.push({
      __row: norm.__row!,
      __raw: norm.__raw!,
      __issues: issues,
      __valid: norm.__valid!,
      name: norm.name || "",
      category: norm.category || "",
      brand: norm.brand || "",
      base_price: norm.base_price ?? 0,
      stock_quantity: norm.stock_quantity ?? 0,
      unit: norm.unit || "adet",
      sku: norm.sku || "",
      barcode: norm.barcode || "",
      description: norm.description || "",
      min_order: norm.min_order ?? 1,
      weight: norm.weight ?? 0,
      image_url: norm.image_url || "",
    });
  });
  return out;
}

export default function BayiUrunImportPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const [screen, setScreen] = useState<Screen>("init");
  const [initError, setInitError] = useState("");
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [existingCount, setExistingCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [normalizedRows, setNormalizedRows] = useState<NormalizedRow[]>([]);
  const [saveResult, setSaveResult] = useState<{
    inserted: number;
    errors: { row: number; reason: string }[];
    totalRows: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [parseError, setParseError] = useState("");

  // Init: token doğrula
  useEffect(() => {
    if (!token) {
      setInitError("Geçersiz link — token bulunamadı.");
      return;
    }
    fetch(`/api/bayi-urun-import/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Init hatası");
        setExistingCategories(data.categories || []);
        setExistingCount(data.existingProductCount || 0);
        setScreen("select");
      })
      .catch(e => setInitError(e.message || "Bağlantı hatası"));
  }, [token]);

  const summary = useMemo(() => {
    const valid = normalizedRows.filter(r => r.__valid).length;
    const invalid = normalizedRows.length - valid;
    const mappedFields = new Set<string>();
    parsedHeaders.forEach(h => { if (FIELD_ALIASES[h]) mappedFields.add(FIELD_ALIASES[h]); });
    return { valid, invalid, mappedFields: Array.from(mappedFields) };
  }, [normalizedRows, parsedHeaders]);

  async function handleFile(file: File) {
    setParseError("");
    setFileName(file.name);
    try {
      let parsed: { headers: string[]; rows: Record<string, string>[] };
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        parsed = await parseExcelFile(file);
      } else {
        const text = await file.text();
        parsed = parseCsvText(text);
      }
      if (parsed.rows.length === 0) {
        setParseError("Dosyada veri satırı bulunamadı.");
        return;
      }
      const norm = normalizeRows(parsed.headers, parsed.rows);
      setParsedHeaders(parsed.headers);
      setNormalizedRows(norm);
      setScreen("preview");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Dosya okunamadı");
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setScreen("saving");
    try {
      const payload = normalizedRows
        .filter(r => r.__valid)
        .map(r => ({
          name: r.name,
          category: r.category || undefined,
          brand: r.brand || undefined,
          base_price: r.base_price,
          stock_quantity: r.stock_quantity,
          unit: r.unit,
          sku: r.sku || undefined,
          barcode: r.barcode || undefined,
          description: r.description || undefined,
          min_order: r.min_order,
          weight: r.weight,
          image_url: r.image_url || undefined,
        }));
      const res = await fetch("/api/bayi-urun-import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rows: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydetme hatası");
      // Client-side validation hatalarını da sonuçlara ekle
      const clientErrors = normalizedRows.filter(r => !r.__valid).map(r => ({
        row: r.__row,
        reason: r.__issues.join("; "),
      }));
      setSaveResult({
        inserted: data.inserted || 0,
        errors: [...clientErrors, ...(data.errors || [])],
        totalRows: normalizedRows.length,
      });
      setScreen("result");
    } catch (e) {
      setSaveResult({
        inserted: 0,
        errors: [{ row: 0, reason: e instanceof Error ? e.message : "Bağlantı hatası" }],
        totalRows: normalizedRows.length,
      });
      setScreen("result");
    } finally {
      setSaving(false);
    }
  }

  function downloadErrorsCsv() {
    if (!saveResult) return;
    const lines = ["satir,hata", ...saveResult.errors.map(e => `${e.row},"${e.reason.replace(/"/g, '""')}"`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hatalar.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/50 rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-700 mb-2">Bağlantı hatası</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{initError}</p>
        </div>
      </div>
    );
  }

  if (screen === "init") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-slate-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Toplu Ürün Yükleme</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            CSV veya Excel dosyasıyla katalogunuza tek seferde yüzlerce ürün ekleyin.
          </p>
        </header>

        {/* SCREEN 1 — SELECT */}
        {screen === "select" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">1. Şablonu indirin</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                Doğru sütun başlıkları ve örnek 5 ürün ile hazır şablonu kullanın.
              </p>
              <a
                href="/bayi-urun-template.csv"
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
              >
                ⬇ Şablonu İndir (CSV)
              </a>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">2. Dosyanızı yükleyin</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                Desteklenen formatlar: <strong>CSV</strong>, <strong>Excel (.xlsx, .xls)</strong>.
                Excel dosyaları tarayıcıda lokal olarak okunur, Microsoft hesabı gerekmez.
              </p>
              <input
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:font-medium hover:file:bg-indigo-700 cursor-pointer"
              />
              {parseError && (
                <p className="text-xs text-rose-600 mt-2">{parseError}</p>
              )}
            </div>

            {existingCount > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-3 text-xs text-amber-800">
                ℹ️ Sisteminizde zaten <strong>{existingCount}</strong> ürün mevcut. Yeni yüklenen ürünler eklenir, mevcut ürünler etkilenmez.
                {existingCategories.length > 0 && (
                  <> Kullanılan kategoriler: {existingCategories.slice(0, 5).join(", ")}{existingCategories.length > 5 ? "..." : ""}.</>
                )}
              </div>
            )}
          </div>
        )}

        {/* SCREEN 2 — PREVIEW */}
        {screen === "preview" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Önizleme — {fileName}</h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {normalizedRows.length} satır okundu — {summary.valid} geçerli
                    {summary.invalid > 0 && <>, <span className="text-rose-600">{summary.invalid} hatalı</span></>}
                  </p>
                </div>
                <button
                  onClick={() => { setScreen("select"); setNormalizedRows([]); setParsedHeaders([]); setFileName(""); }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Geri Dön
                </button>
              </div>
              <div className="text-xs text-slate-500 mb-3">
                Eşleştirilen alanlar: {summary.mappedFields.length > 0 ? summary.mappedFields.join(", ") : "(yok)"}
                {!summary.mappedFields.includes("name") && (
                  <span className="text-rose-600"> — UYARI: 'ad' sütunu bulunamadı, satırlar geçersiz sayılacak.</span>
                )}
              </div>

              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-500">Satır</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-500">Ad</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-500">Kategori</th>
                      <th className="px-2 py-1.5 text-right font-medium text-slate-500">Fiyat</th>
                      <th className="px-2 py-1.5 text-right font-medium text-slate-500">Stok</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-500">SKU</th>
                      <th className="px-2 py-1.5 text-left font-medium text-slate-500">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows.slice(0, 10).map((r) => (
                      <tr key={r.__row} className={`border-t border-slate-100 ${!r.__valid ? "bg-rose-50 dark:bg-rose-950/30" : ""}`}>
                        <td className="px-2 py-1.5 text-slate-400">{r.__row}</td>
                        <td className="px-2 py-1.5 text-slate-900 dark:text-slate-100 font-medium truncate max-w-[12rem]">{r.name || <span className="text-rose-500">—</span>}</td>
                        <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">{r.category || "—"}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{r.base_price > 0 ? r.base_price.toLocaleString("tr-TR") : <span className="text-rose-500">—</span>}</td>
                        <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-400">{r.stock_quantity}</td>
                        <td className="px-2 py-1.5 text-slate-500 truncate max-w-[8rem]">{r.sku || "—"}</td>
                        <td className="px-2 py-1.5">
                          {r.__valid ? (
                            <span className="text-emerald-600">✓</span>
                          ) : (
                            <span className="text-rose-600" title={r.__issues.join("; ")}>✗ {r.__issues[0]}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {normalizedRows.length > 10 && (
                  <p className="text-xs text-slate-400 mt-2 px-2">
                    + {normalizedRows.length - 10} satır daha (önizleme yalnızca ilk 10 satırı gösterir)
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={summary.valid === 0 || saving}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {summary.valid} geçerli ürünü yükle
              </button>
              <button
                onClick={() => { setScreen("select"); setNormalizedRows([]); setParsedHeaders([]); setFileName(""); }}
                className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* SCREEN — SAVING */}
        {screen === "saving" && (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-8 text-center">
            <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-700 dark:text-slate-300">Ürünler kaydediliyor...</p>
            <p className="text-xs text-slate-500 mt-1">Büyük dosyalar 30 saniyeyi bulabilir.</p>
          </div>
        )}

        {/* SCREEN 3 — RESULT */}
        {screen === "result" && saveResult && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Yükleme Sonucu</h2>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700">{saveResult.inserted}</div>
                  <div className="text-xs text-emerald-600 mt-0.5">Başarılı</div>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-rose-700">{saveResult.errors.length}</div>
                  <div className="text-xs text-rose-600 mt-0.5">Hatalı</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{saveResult.totalRows}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Toplam</div>
                </div>
              </div>

              {saveResult.errors.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300">Hata Listesi (ilk 20)</h3>
                    <button onClick={downloadErrorsCsv} className="text-xs text-indigo-600 hover:underline">
                      Tam listeyi CSV indir
                    </button>
                  </div>
                  <ul className="text-xs text-rose-700 space-y-1 max-h-48 overflow-y-auto bg-rose-50 dark:bg-rose-950/30 rounded-lg p-3">
                    {saveResult.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        <span className="font-mono text-rose-500">satır {e.row}:</span> {e.reason}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <button
              onClick={() => {
                setScreen("select");
                setNormalizedRows([]);
                setParsedHeaders([]);
                setFileName("");
                setSaveResult(null);
                setParseError("");
              }}
              className="w-full px-4 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800"
            >
              Yeni Yükleme Yap
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
