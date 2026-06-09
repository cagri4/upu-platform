"use client";

/**
 * Dağıtıcı Dashboard — Faz 1.1.
 * KPI 4 kart + son siparişler + geciken bayiler + hızlı aksiyon.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ClipboardCheck, Megaphone, UserPlus } from "lucide-react";
import { KPICard, DataTable, StatusBadge, type DataTableColumn, type StatusTone } from "@/components/admin/v3-shell";

interface RecentOrder {
  id: string;
  orderNumber: string;
  dealerName: string;
  totalAmount: number;
  statusCode: string;
  statusName: string;
  createdAt: string;
}

interface OverdueDealer {
  id: string;
  name: string;
  city: string | null;
  contact: string | null;
  balance: number;
  updatedAt: string;
}

interface Stats {
  kpi: {
    todayOrders: number;
    todayRevenue: number;
    pendingApproval: number;
    overdueDealers: number;
  };
  recentOrders: RecentOrder[];
  overdueDealers: OverdueDealer[];
}

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);

const formatTarih = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_TONE: Record<string, StatusTone> = {
  pending: "warning",
  approved: "info",
  preparing: "info",
  shipped: "info",
  in_transit: "info",
  delivering: "info",
  delivered: "success",
  cancelled: "danger",
  rejected: "danger",
};

export default function DagiticiDashboardPage() {
  const params = useParams();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dagitici/dashboard/stats", {
          credentials: "same-origin",
        });
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok || !d.success) {
          setError(d.error || "Veri yüklenemedi.");
          setLoading(false);
          return;
        }
        setStats({
          kpi: d.kpi,
          recentOrders: d.recentOrders,
          overdueDealers: d.overdueDealers,
        });
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Bağlantı hatası.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const orderColumns: DataTableColumn<RecentOrder>[] = [
    {
      key: "orderNumber",
      header: "Sipariş No",
      sortable: true,
      sortValue: (r) => r.orderNumber,
      render: (r) => <span className="font-medium tabular-nums text-slate-900">{r.orderNumber}</span>,
    },
    {
      key: "dealerName",
      header: "Bayi",
      sortable: true,
      sortValue: (r) => r.dealerName,
      render: (r) => <span className="text-slate-700">{r.dealerName}</span>,
    },
    {
      key: "createdAt",
      header: "Tarih",
      sortable: true,
      sortValue: (r) => r.createdAt,
      render: (r) => (
        <span className="text-slate-600 tabular-nums">{formatTarih(r.createdAt)}</span>
      ),
    },
    {
      key: "totalAmount",
      header: "Tutar",
      align: "right",
      sortable: true,
      sortValue: (r) => r.totalAmount,
      render: (r) => (
        <span className="font-medium tabular-nums text-slate-900">{formatPara(r.totalAmount)}</span>
      ),
    },
    {
      key: "status",
      header: "Durum",
      render: (r) => (
        <StatusBadge tone={STATUS_TONE[r.statusCode] || "neutral"}>{r.statusName}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            Dağıtıcı kontrol paneli
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Bugünkü iş özetin ve aksiyon bekleyen kalemler.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/dagitici-panel/bayiler/yeni`}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <UserPlus className="h-4 w-4" />
            Bayi Davet Et
          </Link>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading || !stats ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))
        ) : (
          <>
            <KPICard
              label="Bugünkü sipariş"
              value={stats.kpi.todayOrders.toString()}
              hint={stats.kpi.todayOrders === 0 ? "Henüz sipariş yok" : "Bugün gelen toplam sipariş"}
            />
            <KPICard
              label="Bugünkü ciro"
              value={formatPara(stats.kpi.todayRevenue)}
              hint={stats.kpi.todayRevenue === 0 ? "—" : "Bugün toplam"}
            />
            <KPICard
              label="Bekleyen onay"
              value={stats.kpi.pendingApproval.toString()}
              hint={stats.kpi.pendingApproval > 0 ? "Aksiyon gerek" : "Tüm onaylar verildi"}
              delta={stats.kpi.pendingApproval > 0 ? "Aksiyon gerek" : undefined}
              deltaTone="warning"
            />
            <KPICard
              label="Geciken bayi"
              value={stats.kpi.overdueDealers.toString()}
              hint={stats.kpi.overdueDealers === 0 ? "Hepsi günü güne" : "Risk + gecikmiş"}
              delta={stats.kpi.overdueDealers > 0 ? "Dikkat" : undefined}
              deltaTone="danger"
            />
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Son siparişler</h2>
              <p className="text-xs text-slate-500">Son alınan 10 sipariş</p>
            </div>
            <Link
              href={`/${locale}/dagitici-panel/siparisler`}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              Tümü →
            </Link>
          </div>
          {loading || !stats ? (
            <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <DataTable
              rows={stats.recentOrders}
              columns={orderColumns}
              rowKey={(r) => r.id}
              emptyText="Henüz sipariş yok."
            />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Geciken bayiler</h2>
              <p className="text-xs text-slate-500">Risk veya vade aşımı</p>
            </div>
            {stats && stats.overdueDealers.length > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-rose-50 px-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                {stats.overdueDealers.length}
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-col divide-y divide-slate-100">
            {loading || !stats ? (
              <div className="space-y-2 py-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : stats.overdueDealers.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500">Tüm bayiler günü güne.</p>
            ) : (
              stats.overdueDealers.map((b) => (
                <Link
                  key={b.id}
                  href={`/${locale}/dagitici-panel/bayiler/${b.id}`}
                  className="block py-3 first:pt-0 last:pb-0 hover:bg-slate-50/40 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{b.name}</p>
                      <p className="text-xs text-slate-500">
                        {[b.city, b.contact].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <p className="text-xs font-medium tabular-nums text-rose-600">
                      {formatPara(b.balance)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href={`/${locale}/dagitici-panel/bayiler/yeni`}
          className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <UserPlus className="h-5 w-5 text-emerald-600" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Bayi davet et</p>
          <p className="text-xs text-slate-500">Yeni bayi kaydı oluştur</p>
        </Link>
        <Link
          href={`/${locale}/dagitici-panel/siparisler?status=pending`}
          className="group rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <ClipboardCheck className="h-5 w-5 text-emerald-600" />
          <p className="mt-2 text-sm font-semibold text-slate-900">Sipariş onayla</p>
          <p className="text-xs text-slate-500">Bekleyen onayları gözden geçir</p>
        </Link>
        <div className="rounded-xl border border-slate-200 bg-white p-4 opacity-60">
          <Megaphone className="h-5 w-5 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Yeni kampanya</p>
          <p className="text-xs text-slate-500">Faz 1.3'te eklenecek</p>
        </div>
      </section>
    </div>
  );
}
