"use client";

/**
 * Dağıtıcı Bayi Listesi — Faz 1.1.
 * Filtre bar (arama, segment, region, durum) + DataTable + pagination + yeni bayi link.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { DataTable, StatusBadge, type DataTableColumn, type StatusTone } from "@/components/admin/v3-shell";

interface BayiRow {
  id: string;
  name: string;
  contactName: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  district: string | null;
  segment: string | null;
  region: string | null;
  balance: number;
  creditLimit: number | null;
  paymentTermDays: number | null;
  riskStatus: string;
  isActive: boolean;
  updatedAt: string;
}

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const SEGMENT_TONE: Record<string, StatusTone> = {
  A: "success",
  B: "info",
  C: "warning",
};

const RISK_TONE: Record<string, StatusTone> = {
  clean: "neutral",
  watch: "warning",
  overdue: "danger",
  risk: "danger",
};

const RISK_LABEL: Record<string, string> = {
  clean: "Temiz",
  watch: "Takip",
  overdue: "Vade aşımı",
  risk: "Risk",
};

export default function DagiticiBayilerListPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [q, setQ] = useState("");
  const [segment, setSegment] = useState("");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "all">("active");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [rows, setRows] = useState<BayiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams({
        q,
        segment,
        region,
        status,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/dagitici/bayiler?${sp.toString()}`, {
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
  }, [q, segment, region, status, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const columns: DataTableColumn<BayiRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Bayi",
        sortable: true,
        sortValue: (r) => r.name.toLocaleLowerCase("tr-TR"),
        render: (r) => (
          <div>
            <p className="text-sm font-medium text-slate-900">{r.name}</p>
            <p className="text-xs text-slate-500">
              {[r.contactName, r.phone].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        ),
      },
      {
        key: "segment",
        header: "Segment",
        render: (r) =>
          r.segment ? (
            <StatusBadge tone={SEGMENT_TONE[r.segment] || "neutral"}>{r.segment}</StatusBadge>
          ) : (
            <span className="text-xs text-slate-400">Atanmamış</span>
          ),
      },
      {
        key: "region",
        header: "Bölge",
        sortable: true,
        sortValue: (r) => r.region || "",
        render: (r) => (
          <span className="text-sm text-slate-700">
            {r.region || [r.city, r.district].filter(Boolean).join(" / ") || "—"}
          </span>
        ),
      },
      {
        key: "balance",
        header: "Bakiye",
        align: "right",
        sortable: true,
        sortValue: (r) => r.balance,
        render: (r) => (
          <span className="font-medium tabular-nums text-slate-900">{formatPara(r.balance)}</span>
        ),
      },
      {
        key: "updatedAt",
        header: "Son güncelleme",
        sortable: true,
        sortValue: (r) => r.updatedAt,
        render: (r) => <span className="text-sm text-slate-600 tabular-nums">{formatTarih(r.updatedAt)}</span>,
      },
      {
        key: "risk",
        header: "Durum",
        render: (r) =>
          r.isActive ? (
            <StatusBadge tone={RISK_TONE[r.riskStatus] || "neutral"}>
              {RISK_LABEL[r.riskStatus] || r.riskStatus}
            </StatusBadge>
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
          <h1 className="text-2xl font-semibold text-slate-900">Bayiler</h1>
          <p className="mt-1 text-sm text-slate-600">{total} bayi · sayfa {page}/{totalPages}</p>
        </div>
        <Link
          href={`/${locale}/dagitici-panel/bayiler/yeni`}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Yeni Bayi Ekle
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="İsim, telefon, kişi ara"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <select
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Tüm segmentler</option>
            <option value="A">A — Premium</option>
            <option value="B">B — Standart</option>
            <option value="C">C — Yeni / küçük</option>
          </select>
          <input
            type="text"
            placeholder="Bölge"
            value={region}
            onChange={(e) => {
              setRegion(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
          />
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
            onRowClick={(r) => router.push(`/${locale}/dagitici-panel/bayiler/${r.id}`)}
            emptyText="Filtreye uygun bayi yok. Üstten 'Yeni Bayi Ekle' ile başlayabilirsin."
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
          <span className="text-slate-500">Sayfa {page}/{totalPages}</span>
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
