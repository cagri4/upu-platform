"use client";

/**
 * Fiyat liste başlıkları — liste + yeni başlık link.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  DataTable,
  StatusBadge,
  type DataTableColumn,
} from "@/components/admin/v3-shell";

interface Row {
  id: string;
  name: string;
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  currency: string;
  itemCount: number;
  assignedDealerCount: number;
  updatedAt: string;
}

const formatTarih = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function FiyatListeleriPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({ q, status });
      const res = await fetch(`/api/dagitici/fiyat-listeleri?${sp.toString()}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setRows(d.items);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const columns: DataTableColumn<Row>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Liste",
        sortable: true,
        sortValue: (r) => r.name.toLocaleLowerCase("tr-TR"),
        render: (r) => (
          <div>
            <p className="text-sm font-medium text-slate-900">{r.name}</p>
            <p className="text-xs text-slate-500">{r.description || "—"}</p>
          </div>
        ),
      },
      {
        key: "items",
        header: "Ürün sayısı",
        align: "right",
        sortable: true,
        sortValue: (r) => r.itemCount,
        render: (r) => (
          <span className="tabular-nums text-slate-700">{r.itemCount}</span>
        ),
      },
      {
        key: "dealers",
        header: "Atanmış bayi",
        align: "right",
        sortable: true,
        sortValue: (r) => r.assignedDealerCount,
        render: (r) => (
          <span className="tabular-nums text-slate-700">
            {r.assignedDealerCount}
          </span>
        ),
      },
      {
        key: "validity",
        header: "Geçerlilik",
        render: (r) => (
          <span className="text-xs text-slate-600 tabular-nums">
            {formatTarih(r.validFrom)} → {formatTarih(r.validUntil)}
          </span>
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
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Fiyat Listeleri</h1>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} liste — segment, kampanya, müşteri-özel
          </p>
        </div>
        <Link
          href={`/${locale}/dagitici-panel/fiyat-listeleri/yeni`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Yeni Liste
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Liste adı ara"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
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
              router.push(`/${locale}/dagitici-panel/fiyat-listeleri/${r.id}`)
            }
            emptyText="Henüz fiyat listesi yok. Üstten 'Yeni Liste' ile başla."
          />
        )}
      </section>
    </div>
  );
}
