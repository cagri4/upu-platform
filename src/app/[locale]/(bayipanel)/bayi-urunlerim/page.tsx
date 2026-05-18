"use client";

/**
 * Ürünlerim — bayi ürün katalogu listesi (Sprint B-2 pattern).
 *
 * URL: /tr/bayi-urunlerim?t=<token>
 *
 * Pattern: bayi-siparislerim ile aynı (HeroBanner + filter chips + search
 * + Skeleton + empty state). Endpoint: /api/urunler/list (mevcut, bayi_products
 * tablosu tenant_id filter'lı).
 *
 * Filter chip'ler: Tümü / Mevcut (stk > low) / Kritik (stk > 0 && stk <= low) /
 * Tükendi (stk = 0). Server-side filtre — endpoint stockStatus döner.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Package, PlusCircle, Search } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

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

interface StockGroup {
  key: "tum" | "mevcut" | "kritik" | "tukenmis";
  label: string;
  badge: string;
}

const STOCK_GROUPS: StockGroup[] = [
  { key: "tum",      label: "Tümü",    badge: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" },
  { key: "mevcut",   label: "Mevcut",  badge: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" },
  { key: "kritik",   label: "Kritik",  badge: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400" },
  { key: "tukenmis", label: "Tükendi", badge: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400" },
];

const STOCK_STATUS_BADGE: Record<string, string> = {
  ok:       "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400",
  critical: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
  out:      "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400",
};

const STOCK_STATUS_LABEL: Record<string, string> = {
  ok:       "Mevcut",
  critical: "Kritik",
  out:      "Tükendi",
};

function formatTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(n);
}

export default function UrunlerimPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [activeStock, setActiveStock] = useState<StockGroup["key"]>("tum");

  // Debounce search
  useEffect(() => {
    const handle = setTimeout(() => setQ(searchInput), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("t", token);
    sp.set("pageSize", "100");
    if (q) sp.set("q", q);
    if (activeStock !== "tum") sp.set("stock", activeStock);
    fetch(`/api/urunler/list?${sp.toString()}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Liste alınamadı");
        setRows(d.rows || []);
        setTotal(d.total || 0);
        setError("");
      })
      .catch((e) => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [token, q, activeStock]);

  // Stock status sayım (client-side, mevcut sayfanın rows üzerinden)
  const counts = useMemo(() => {
    const m: Record<string, number> = { tum: total };
    if (activeStock === "tum") {
      m.mevcut = rows.filter((r) => r.stockStatus === "ok").length;
      m.kritik = rows.filter((r) => r.stockStatus === "critical").length;
      m.tukenmis = rows.filter((r) => r.stockStatus === "out").length;
    }
    return m;
  }, [rows, total, activeStock]);

  const addHref = token ? `/tr/bayi-urun-ekle?t=${encodeURIComponent(token)}` : "/tr/bayi-urun-ekle";

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Package}
        title="Ürünlerim"
        subtitle="Ürün katalogunuzu ve stok durumunu buradan yönetin."
        ctaLabel="+ Yeni Ürün"
        ctaHref={addHref}
      />

      {/* Filter chip row */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {STOCK_GROUPS.map((g) => {
          const isActive = activeStock === g.key;
          const c = counts[g.key];
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setActiveStock(g.key)}
              className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition active:scale-95 ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300"
              }`}
            >
              <span>{g.label}</span>
              {typeof c === "number" && (
                <span
                  className={`px-1.5 rounded-full text-[10px] font-semibold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {c}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={2.2} />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Ürün adı, kod, marka veya barkod…"
          className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      {/* Liste */}
      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="h-16" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center">
          <PlusCircle className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {q || activeStock !== "tum"
              ? "Bu filtre/aramayla eşleşen ürün yok."
              : "Henüz ürün yok."}
          </p>
          <a
            href={addHref}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg active:scale-95 transition"
          >
            <PlusCircle className="w-4 h-4" strokeWidth={2.2} />
            Yeni Ürün Ekle
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const badgeCls = STOCK_STATUS_BADGE[p.stockStatus] || STOCK_STATUS_BADGE.ok;
            const badgeLabel = STOCK_STATUS_LABEL[p.stockStatus] || "—";
            return (
              <div
                key={p.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                        {p.name}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badgeCls}`}>
                        {badgeLabel} · {p.stockQuantity} {p.unit}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {p.code && <span>{p.code}</span>}
                      {p.brand && <span> · {p.brand}</span>}
                      {p.category && <span> · {p.category}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {formatTry(p.unitPrice || p.basePrice)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      /{p.unit}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer count */}
      {!loading && !error && rows.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center px-4">
          {rows.length} ürün gösteriliyor
          {total !== rows.length && ` (toplam ${total})`}
        </p>
      )}
    </div>
  );
}
