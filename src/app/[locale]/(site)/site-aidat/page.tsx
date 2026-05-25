"use client";

/**
 * /tr/site-aidat — Aidat ledger sayfası (banking style).
 *
 * Sekme: Ödenmemiş / Tümü. ListCard her dönem+daire kombinasyonu için.
 * Üstte özet StatCard: Toplam Borç + Bu Ay Tahsilat + Ödenmemiş Daire.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet, TrendingUp, AlertTriangle, Receipt } from "lucide-react";
import { HeroBanner, ListCard, Skeleton, StatCard } from "@/components/banking";

interface LedgerEntry {
  id: string;
  period: string;
  unit_number: string;
  amount_tl: number;
  paid_tl: number;
  late_tl: number;
  owed_tl: number;
  is_paid: boolean;
}

interface Summary {
  totalDueTL: number;
  totalPaidTL: number;
  unpaidCount: number;
}

type Tab = "unpaid" | "all";

function formatCurrency(n: number): string {
  if (!n) return "₺0";
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${Math.round(n / 1_000)}K`;
  return `₺${Math.round(n).toLocaleString("tr-TR")}`;
}

function formatPeriod(p: string): string {
  // 2026-03 → "Mart 2026"
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (!m) return p;
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const monthIdx = parseInt(m[2], 10) - 1;
  return `${months[monthIdx] || m[2]} ${m[1]}`;
}

export default function SiteAidatPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [tab, setTab] = useState<Tab>("unpaid");
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (tab === "unpaid") params.set("filter", "unpaid");
    if (token) params.set("t", token);
    const qs = params.toString() ? `?${params.toString()}` : "";

    fetch(`/api/site/aidat${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          setError(d.error);
          return;
        }
        setLedger(d.ledger || []);
        setSummary(d.summary || null);
      })
      .catch(() => setError("Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, [tab, token]);

  const tahsilatHref = token
    ? `/api/panel/start?cmd=aidat&t=${encodeURIComponent(token)}`
    : "#";

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Wallet}
        title="Aidat Yönetimi"
        subtitle="Daire bazında borç, tahsilat ve gecikme takibi."
        ctaLabel="Tahsilat Kaydet"
        ctaHref={tahsilatHref}
      />

      {/* Özet KPI'lar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {loading || !summary ? (
          <>
            <Skeleton height="h-28" />
            <Skeleton height="h-28" />
            <Skeleton height="h-28" />
          </>
        ) : (
          <>
            <StatCard
              Icon={AlertTriangle}
              value={formatCurrency(summary.totalDueTL)}
              label="Toplam Borç"
            />
            <StatCard
              Icon={TrendingUp}
              value={formatCurrency(summary.totalPaidTL)}
              label="Toplam Tahsilat"
            />
            <StatCard
              Icon={Receipt}
              value={summary.unpaidCount}
              label="Ödenmemiş Kayıt"
            />
          </>
        )}
      </div>

      {/* Tab toggle */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-1.5 inline-flex shadow-sm">
        <TabButton active={tab === "unpaid"} onClick={() => setTab("unpaid")}>
          Ödenmemiş
        </TabButton>
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          Tümü
        </TabButton>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height="h-16" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-2xl p-4 text-sm">
            ⚠ {error}
          </div>
        ) : ledger.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          ledger.map((row) => (
            <ListCard
              key={row.id}
              Icon={row.is_paid ? Receipt : AlertTriangle}
              title={`Daire ${row.unit_number} · ${formatPeriod(row.period)}`}
              subtitle={
                row.is_paid
                  ? `Ödendi · ${formatCurrency(row.paid_tl)}`
                  : `Borç ${formatCurrency(row.owed_tl)}${row.late_tl > 0 ? ` · gecikme ${formatCurrency(row.late_tl)}` : ""}`
              }
              rightLabel={row.is_paid ? "Ödendi" : "Borç"}
              href={tahsilatHref}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-xl text-sm font-medium transition ${
        active
          ? "bg-emerald-600 text-white shadow-sm"
          : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
      }`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-6 text-center space-y-2">
      <div className="text-4xl">{tab === "unpaid" ? "✅" : "📋"}</div>
      <div className="font-semibold text-slate-900 dark:text-white">
        {tab === "unpaid" ? "Tüm aidatlar ödendi" : "Aidat kaydı yok"}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {tab === "unpaid"
          ? "Şu an binadaki tüm dönemlerde tahsilat tamamlanmış."
          : "Henüz aidat tahakkuk kaydı oluşturulmamış."}
      </p>
    </div>
  );
}
