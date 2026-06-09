"use client";

/**
 * Dağıtıcı Ürün Listesi — Faz 1.2.
 * Filtre bar (arama, kategori, durum) + DataTable + pagination.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Search, FileSpreadsheet } from "lucide-react";
import {
  DataTable,
  StatusBadge,
  type DataTableColumn,
  type StatusTone,
} from "@/components/admin/v3-shell";

interface Row {
  id: string;
  code: string;
  name: string;
  basePrice: number;
  stockQuantity: number;
  lowStockThreshold: number | null;
  isActive: boolean;
  categoryId: string | null;
  unit: string;
  barcode: string | null;
  brand: string | null;
  updatedAt: string;
}

interface CategoryFlat {
  id: string;
  name: string;
  parentId: string | null;
}

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

export default function DagiticiUrunlerListPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<CategoryFlat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dagitici/kategoriler", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCategories(d.flat || []);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({
        q,
        category_id: categoryId,
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/dagitici/urunler?${sp.toString()}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Veri yüklenemedi.");
        return;
      }
      setRows(d.items);
      setTotal(d.total);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, status, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) || "—" : "—");
  }, [categories]);

  const stockTone = (r: Row): StatusTone => {
    if (r.stockQuantity <= 0) return "danger";
    if (r.lowStockThreshold && r.stockQuantity < r.lowStockThreshold) return "warning";
    return "success";
  };
  const stockLabel = (r: Row) => {
    if (r.stockQuantity <= 0) return "Stok yok";
    if (r.lowStockThreshold && r.stockQuantity < r.lowStockThreshold) return "Az stok";
    return "Stokta";
  };

  const columns: DataTableColumn<Row>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Ürün",
        sortable: true,
        sortValue: (r) => r.name.toLocaleLowerCase("tr-TR"),
        render: (r) => (
          <div>
            <p className="text-sm font-medium text-slate-900">{r.name}</p>
            <p className="text-xs text-slate-500">
              {[r.code, r.brand].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        ),
      },
      {
        key: "category",
        header: "Kategori",
        render: (r) => (
          <span className="text-sm text-slate-700">{categoryName(r.categoryId)}</span>
        ),
      },
      {
        key: "basePrice",
        header: "Fiyat",
        align: "right",
        sortable: true,
        sortValue: (r) => r.basePrice,
        render: (r) => (
          <span className="font-medium tabular-nums text-slate-900">
            {formatPara(r.basePrice)}
          </span>
        ),
      },
      {
        key: "stock",
        header: "Stok",
        align: "right",
        sortable: true,
        sortValue: (r) => r.stockQuantity,
        render: (r) => (
          <div className="flex flex-col items-end gap-1">
            <span className="text-sm tabular-nums text-slate-700">
              {r.stockQuantity} {r.unit}
            </span>
            <StatusBadge tone={stockTone(r)}>{stockLabel(r)}</StatusBadge>
          </div>
        ),
      },
      {
        key: "status",
        header: "Durum",
        render: (r) =>
          r.isActive ? (
            <StatusBadge tone="success">Aktif</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Pasif</StatusBadge>
          ),
      },
    ],
    [categoryName],
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Ürünler</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} ürün · sayfa {page}/{totalPages}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/dagitici-panel/urunler/import`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel İçeri Aktar
          </Link>
          <Link
            href={`/${locale}/dagitici-panel/urunler/yeni`}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Yeni Ürün
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Kod, isim, barkod, marka"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Tüm kategoriler</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
            <option value="all">Hepsi</option>
          </select>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.id}
            onRowClick={(r) =>
              router.push(`/${locale}/dagitici-panel/urunler/${r.id}`)
            }
            emptyText="Henüz ürün yok. Üstten 'Yeni Ürün' veya 'Excel İçeri Aktar' ile başla."
          />
        )}
      </section>

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
