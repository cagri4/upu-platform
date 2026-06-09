"use client";

/**
 * Bayi Katalog (Faz 2 Sprint B).
 *
 * Sol filtre paneli + sağda kart/liste grid. Mobile'da filtre drawer.
 * Arama + kategori + marka + stokta-olan + sıralama + sayfalama + favori.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Search,
  Heart,
  Filter,
  X,
  LayoutGrid,
  List,
  Package,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";

interface Row {
  id: string;
  code: string;
  name: string;
  description: string | null;
  basePrice: number;
  unit: string;
  imageUrl: string | null;
  stockQuantity: number;
  lowStockThreshold: number | null;
  categoryId: string | null;
  brand: string | null;
  isFavorite: boolean;
}

interface Facets {
  categories: Array<{ id: string; name: string }>;
  brands: string[];
}

type ViewMode = "grid" | "list";

const SORT_LABEL: Record<string, string> = {
  newest: "Yeni eklenenler",
  name_asc: "İsme göre A→Z",
  price_asc: "Fiyat artan",
  price_desc: "Fiyat azalan",
};

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

function stockBadge(r: Row): { tone: StatusTone; label: string } {
  if (r.stockQuantity <= 0) return { tone: "danger", label: "Stokta yok" };
  if (r.lowStockThreshold && r.stockQuantity < r.lowStockThreshold)
    return { tone: "warning", label: "Az stok" };
  return { tone: "success", label: "Stokta" };
}

export default function BayiKatalogPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets>({ categories: [], brands: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({
        q,
        category_id: categoryId,
        brand,
        in_stock: inStock ? "1" : "",
        sort,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/bayi/katalog?${sp.toString()}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setRows(d.items);
      setTotal(d.total);
      setFacets(d.facets || { categories: [], brands: [] });
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, brand, inStock, sort, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function toggleFavorite(id: string) {
    setRows((arr) =>
      arr.map((r) => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r)),
    );
    try {
      const res = await fetch("/api/bayi/favori", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: id }),
      });
      if (!res.ok) throw new Error("fail");
    } catch {
      // Revert on error
      setRows((arr) =>
        arr.map((r) => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r)),
      );
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeFilterCount = useMemo(
    () => [q, categoryId, brand, inStock ? "y" : ""].filter(Boolean).length,
    [q, categoryId, brand, inStock],
  );

  const FilterPanel = (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-medium text-slate-700">Arama</label>
        <div className="relative mt-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Kod, isim, barkod, marka"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700">Kategori</label>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Tüm kategoriler</option>
          {facets.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700">Marka</label>
        <select
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setPage(1);
          }}
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Tüm markalar</option>
          {facets.brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={inStock}
          onChange={(e) => {
            setInStock(e.target.checked);
            setPage(1);
          }}
          className="accent-indigo-600"
        />
        Sadece stokta olanlar
      </label>

      <button
        onClick={() => {
          setQ("");
          setCategoryId("");
          setBrand("");
          setInStock(false);
          setPage(1);
        }}
        className="text-xs font-medium text-indigo-700 hover:underline"
      >
        Filtreleri temizle
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Katalog</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} ürün · sayfa {page}/{totalPages}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
          >
            <Filter className="h-4 w-4" />
            Filtre
            {activeFilterCount > 0 && (
              <span className="rounded bg-indigo-600 px-1.5 text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {Object.entries(SORT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <div className="flex h-9 overflow-hidden rounded-lg border border-slate-200">
            <button
              onClick={() => setView("grid")}
              className={`flex h-full items-center gap-1 px-3 text-xs ${
                view === "grid" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
              }`}
              aria-label="Kart görünümü"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex h-full items-center gap-1 px-3 text-xs ${
                view === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
              }`}
              aria-label="Liste görünümü"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Desktop filter sidebar */}
        <aside className="hidden w-56 shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
          {FilterPanel}
        </aside>

        {/* Mobile filter drawer */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-40 flex bg-slate-900/40 lg:hidden">
            <div className="ml-auto h-full w-80 max-w-[85vw] overflow-y-auto bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Filtrele</h2>
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {FilterPanel}
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              Yükleniyor…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <Package className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 text-sm text-slate-500">
                Filtreye uygun ürün yok. Filtreleri temizleyip tekrar dene.
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((r) => {
                const sb = stockBadge(r);
                return (
                  <div
                    key={r.id}
                    className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <button
                      onClick={() => toggleFavorite(r.id)}
                      className="absolute right-2 top-2 z-10 rounded-full bg-white/80 p-1.5 backdrop-blur transition-colors hover:bg-white"
                      aria-label="Favori"
                    >
                      <Heart
                        className={`h-4 w-4 ${
                          r.isFavorite
                            ? "fill-rose-500 text-rose-500"
                            : "text-slate-400"
                        }`}
                      />
                    </button>
                    <Link
                      href={`/${locale}/bayi/katalog/${r.id}`}
                      className="group flex flex-col gap-2"
                    >
                      <div className="flex h-32 items-center justify-center rounded-lg bg-slate-50">
                        {r.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={r.imageUrl}
                            alt={r.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <Package className="h-10 w-10 text-slate-300" />
                        )}
                      </div>
                      <div className="min-h-[3rem]">
                        <p className="text-xs text-slate-500">
                          {r.code}
                          {r.brand ? ` · ${r.brand}` : ""}
                        </p>
                        <p className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-indigo-700">
                          {r.name}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold tabular-nums text-slate-900">
                          {formatPara(r.basePrice)}
                        </span>
                        <StatusBadge tone={sb.tone}>{sb.label}</StatusBadge>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const sb = stockBadge(r);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                        {r.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={r.imageUrl}
                            alt={r.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-slate-300" />
                        )}
                      </div>
                      <div
                        onClick={() => router.push(`/${locale}/bayi/katalog/${r.id}`)}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <p className="text-xs text-slate-500">
                          {r.code}
                          {r.brand ? ` · ${r.brand}` : ""}
                        </p>
                        <p className="line-clamp-1 text-sm font-medium text-slate-900">
                          {r.name}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums text-slate-900">
                        {formatPara(r.basePrice)}
                      </span>
                      <StatusBadge tone={sb.tone}>{sb.label}</StatusBadge>
                      <button
                        onClick={() => toggleFavorite(r.id)}
                        className="rounded-md p-1.5 hover:bg-slate-100"
                        aria-label="Favori"
                      >
                        <Heart
                          className={`h-4 w-4 ${
                            r.isFavorite
                              ? "fill-rose-500 text-rose-500"
                              : "text-slate-400"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Önceki
          </button>
          <span className="text-slate-500">
            Sayfa {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            Sonraki
          </button>
        </div>
      )}
    </div>
  );
}
