"use client";

/**
 * Kampanya listesi — DataTable + filtre (status, type, q).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  DataTable,
  StatusBadge,
  type DataTableColumn,
  type StatusTone,
} from "@/components/admin/v3-shell";

interface Row {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  status: string;
  computedStatus: string;
  startDate: string;
  endDate: string;
  maxUsage: number | null;
  couponCode: string | null;
  targetCount: number;
  updatedAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  percent_discount: "% İndirim",
  volume_discount: "Al-X-öde-Y",
  coupon: "Kupon",
  gift_product: "Hediye",
  free_shipping: "Ücretsiz Kargo",
};

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
  ended: "info",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  paused: "Pasif",
  ended: "Bitti",
};

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function KampanyalarListPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({ q, status, type });
      const res = await fetch(`/api/dagitici/kampanyalar?${sp.toString()}`, {
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
  }, [q, status, type]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const columns: DataTableColumn<Row>[] = useMemo(
    () => [
      {
        key: "title",
        header: "Kampanya",
        sortable: true,
        sortValue: (r) => r.title.toLocaleLowerCase("tr-TR"),
        render: (r) => (
          <div>
            <p className="text-sm font-medium text-slate-900">{r.title}</p>
            <p className="text-xs text-slate-500">
              {r.type ? TYPE_LABEL[r.type] : "—"}
              {r.couponCode ? ` · kod ${r.couponCode}` : ""}
            </p>
          </div>
        ),
      },
      {
        key: "validity",
        header: "Geçerlilik",
        render: (r) => (
          <span className="text-xs tabular-nums text-slate-600">
            {formatTarih(r.startDate)} → {formatTarih(r.endDate)}
          </span>
        ),
      },
      {
        key: "targets",
        header: "Hedef",
        align: "right",
        render: (r) => (
          <span className="text-sm tabular-nums text-slate-700">
            {r.targetCount}
          </span>
        ),
      },
      {
        key: "max_usage",
        header: "Max Kullanım",
        align: "right",
        render: (r) => (
          <span className="text-sm tabular-nums text-slate-700">
            {r.maxUsage ?? "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Durum",
        render: (r) => (
          <StatusBadge tone={STATUS_TONE[r.computedStatus] || "neutral"}>
            {STATUS_LABEL[r.computedStatus] || r.computedStatus}
          </StatusBadge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Kampanyalar</h1>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} kampanya — % indirim, koli iskontosu, kupon, hediye, kargo
          </p>
        </div>
        <Link
          href={`/${locale}/dagitici-panel/kampanyalar/yeni`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Yeni Kampanya
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Kampanya adı"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Tüm durumlar</option>
            <option value="draft">Taslak</option>
            <option value="active">Aktif</option>
            <option value="paused">Pasif</option>
            <option value="ended">Bitti</option>
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Tüm tipler</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
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
              router.push(`/${locale}/dagitici-panel/kampanyalar/${r.id}`)
            }
            emptyText="Henüz kampanya yok. 'Yeni Kampanya' ile başla."
          />
        )}
      </section>
    </div>
  );
}
