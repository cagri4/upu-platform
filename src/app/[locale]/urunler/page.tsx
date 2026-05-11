/**
 * /urunler — ürün katalog web paneli (magic-link auth, paginated grid).
 *
 * URL: /[locale]/urunler?t=<token>&page=1&q=&category=&stock=tum&pageSize=24
 *
 * Grid kart layout (mobile 2 sütun, desktop 4 sütun):
 *   - Görsel (image_url veya emoji placeholder)
 *   - İsim + marka
 *   - Kod / SKU
 *   - Fiyat (büyük) + birim
 *   - Stok rozet (yeşil ok / sarı kritik / kırmızı tükendi)
 *
 * Tıklanır → /urunler/[id] detay.
 *
 * Tour koridor: useEffect mount'ta tour_urunler_done advance call —
 * Step 4'ten Step 5'e geçirir.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ProductRow {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  basePrice: number;
  unitPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  stockStatus: "out" | "critical" | "ok";
  imageUrl: string | null;
  barcode: string | null;
}

interface ListResp {
  rows: ProductRow[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

interface InitResp {
  user: {
    displayName: string | null;
    sektor: string;
    ticariUnvan: string;
    capabilities: string[];
  };
  categories: string[];
}

const STOCK_OPTIONS = [
  { id: "tum",       label: "Tüm stok" },
  { id: "mevcut",    label: "🟢 Mevcut" },
  { id: "kritik",    label: "🟡 Kritik" },
  { id: "tukenmis",  label: "🔴 Tükendi" },
];

const PAGE_SIZE_OPTIONS = [12, 24, 48];

function formatTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

function stockBadge(p: ProductRow): { text: string; cls: string } {
  if (p.stockStatus === "out") return { text: "Tükendi", cls: "bg-rose-50 text-rose-700 font-semibold" };
  if (p.stockStatus === "critical") return { text: `${p.stockQuantity} kaldı`, cls: "bg-amber-50 text-amber-700" };
  return { text: `${p.stockQuantity} ${p.unit}`, cls: "bg-emerald-50 text-emerald-700" };
}

export default function UrunlerPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t") || params.get("token") || "";
  const [init, setInit] = useState<InitResp | null>(null);
  const [error, setError] = useState("");
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);

  const page = parseInt(params.get("page") || "1", 10);
  const pageSize = parseInt(params.get("pageSize") || "24", 10);
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const stock = params.get("stock") || "tum";

  const [searchInput, setSearchInput] = useState(q);

  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams({ t: token, page: String(page), pageSize: String(pageSize), stock });
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    return `/api/urunler/list?${sp.toString()}`;
  }, [token, page, pageSize, q, category, stock]);

  // Init + tour Adım 4 advance fire-once
  useEffect(() => {
    if (!token) { setError("Geçersiz link — token bulunamadı."); return; }
    fetch(`/api/urunler/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Init hatası");
        setInit(d);
        // Tour koridor — ürün katalog açıldıkça Adım 3 (urunler) tamam.
        fetch(`/api/tour/advance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, event: "tour_urunler_done" }),
        }).catch(() => { /* sessiz */ });
      })
      .catch(e => setError(e.message || "Bağlantı hatası"));
  }, [token]);

  useEffect(() => {
    if (!init) return;
    setLoading(true);
    fetch(apiUrl)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) {
          const detail = d.details || d.hint || d.code || "";
          throw new Error(`${d.error || "Liste alınamadı"}${detail ? ` (${detail})` : ""}`);
        }
        setData(d);
        setError("");
      })
      .catch(e => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [init, apiUrl]);

  function pushParams(updates: Record<string, string | null>) {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    if (token && !sp.has("t")) sp.set("t", token);
    router.push(`?${sp.toString()}`);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== q) pushParams({ q: searchInput || null, page: "1" });
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-rose-200 rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-700 mb-2">Bağlantı hatası</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!init) {
    return <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-sm text-slate-500">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">📦 Ürün Kataloğu</h1>
              {init.user.ticariUnvan && (
                <p className="text-xs text-slate-500 mt-0.5">{init.user.ticariUnvan}</p>
              )}
            </div>
            {data && (
              <div className="text-xs text-slate-500">
                {data.total} ürün · sayfa {data.page}/{data.pages}
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="🔍 İsim, kod, marka, barkod..."
              className="flex-1 min-w-[180px] border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            />
            <select
              value={category}
              onChange={e => pushParams({ category: e.target.value || null, page: "1" })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            >
              <option value="">Tüm kategoriler</option>
              {init.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={stock}
              onChange={e => pushParams({ stock: e.target.value, page: "1" })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            >
              {STOCK_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {loading && !data ? (
          <div className="text-center text-sm text-slate-500 py-8">Yükleniyor...</div>
        ) : data && data.rows.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
            Bu filtreyle eşleşen ürün yok.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data?.rows.map(p => {
              const badge = stockBadge(p);
              const detailHref = `/tr/urunler/${p.id}?t=${encodeURIComponent(token)}`;
              return (
                <Link
                  key={p.id}
                  href={detailHref}
                  className="bg-white dark:bg-slate-800 border border-slate-200 rounded-xl p-3 hover:border-indigo-300 hover:shadow-sm transition flex flex-col"
                >
                  {/* Görsel */}
                  <div className="aspect-square bg-slate-50 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl text-slate-300">📦</span>
                    )}
                  </div>

                  {/* Bilgi */}
                  <div className="flex-1 flex flex-col">
                    {p.brand && <div className="text-[10px] text-slate-400 uppercase truncate">{p.brand}</div>}
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight mt-0.5 mb-1">{p.name}</h3>
                    {p.code && <div className="text-[10px] text-slate-400 font-mono truncate">{p.code}</div>}

                    <div className="mt-auto pt-2 flex items-end justify-between">
                      <div>
                        <div className="text-base font-bold text-slate-900">{formatTry(p.unitPrice)}</div>
                        <div className="text-[10px] text-slate-400">/ {p.unit}</div>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <select
              value={pageSize}
              onChange={e => pushParams({ pageSize: e.target.value, page: "1" })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            >
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} / sayfa</option>)}
            </select>

            <div className="flex items-center gap-2">
              <button
                onClick={() => pushParams({ page: String(Math.max(1, page - 1)) })}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white dark:bg-slate-800 disabled:opacity-40"
              >
                ‹ Önceki
              </button>
              <span className="text-sm text-slate-600">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => pushParams({ page: String(Math.min(data.pages, page + 1)) })}
                disabled={page >= data.pages}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white dark:bg-slate-800 disabled:opacity-40"
              >
                Sonraki ›
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
