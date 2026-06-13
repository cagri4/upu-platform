"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrendingUp, BarChart3, DollarSign, Calendar, BedDouble, Percent } from "lucide-react";
import { HeroBanner, StatCard, Skeleton } from "@/components/banking";

interface Period {
  type: "daily" | "monthly";
  days: number;
  total_revenue: number;
  room_nights: number;
  adr: number;
  occupancy_pct: number;
  revpar: number;
  total_rooms: number;
  reservations_count: number;
}

interface SeriesPoint { bucket: string; revenue: number; nights: number; count: number }
interface SourceBreak { source: string; revenue: number; count: number }
interface StatusBreak { status: string; count: number }

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Onaylı",
  checked_in: "Konaklamada",
  checked_out: "Çıktı",
  pending: "Beklemede",
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manuel",
  booking: "Booking.com",
  expedia: "Expedia",
  airbnb: "Airbnb",
  "walk-in": "Walk-in",
  direct: "Direkt",
};

export default function OtelGelirPage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [period, setPeriod] = useState<Period | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [bySource, setBySource] = useState<SourceBreak[]>([]);
  const [byStatus, setByStatus] = useState<StatusBreak[]>([]);
  const [periodType, setPeriodType] = useState<"daily" | "monthly">("daily");

  useEffect(() => {
    setPeriod(null);
    const qs = `?period=${periodType}${token ? `&t=${encodeURIComponent(token)}` : ""}`;
    fetch(`/api/otel-panel/revenue-report${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => {
        if (d?.period) setPeriod(d.period);
        if (d?.series) setSeries(d.series);
        if (d?.by_source) setBySource(d.by_source);
        if (d?.by_status) setByStatus(d.by_status);
      });
  }, [periodType, token]);

  const maxRevenue = Math.max(1, ...series.map(s => s.revenue));
  const maxSourceRev = Math.max(1, ...bySource.map(s => s.revenue));

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Gelir Raporu"
        subtitle={periodType === "daily" ? "Son 30 günün gün bazlı gelir analizi" : "Son 12 ayın ay bazlı gelir analizi"}
        Icon={TrendingUp}
      />

      <div className="flex gap-2">
        <button
          onClick={() => setPeriodType("daily")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            periodType === "daily" ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
          }`}
        >
          Günlük (30 gün)
        </button>
        <button
          onClick={() => setPeriodType("monthly")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            periodType === "monthly" ? "bg-emerald-600 text-white" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
          }`}
        >
          Aylık (12 ay)
        </button>
      </div>

      {!period ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="h-24" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Toplam Ciro" value={fmtTRY(period.total_revenue)} Icon={DollarSign} />
            <StatCard label="ADR (gecelik ort.)" value={fmtTRY(period.adr)} Icon={BedDouble} />
            <StatCard label="RevPAR" value={fmtTRY(period.revpar)} Icon={BarChart3} />
            <StatCard label="Doluluk" value={`${period.occupancy_pct}%`} Icon={Percent} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" /> {periodType === "daily" ? "Gün Bazlı Gelir" : "Ay Bazlı Gelir"}
              </h3>
              {series.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Veri yok</p>
              ) : (
                <div className="space-y-1.5">
                  {series.map(s => (
                    <div key={s.bucket} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-slate-500 dark:text-slate-400 shrink-0">{s.bucket}</div>
                      <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 dark:from-emerald-700 dark:to-emerald-500"
                          style={{ width: `${(s.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                      <div className="w-24 text-xs text-right text-slate-700 dark:text-slate-300 font-medium shrink-0">{fmtTRY(s.revenue)}</div>
                      <div className="w-12 text-[10px] text-right text-slate-400 shrink-0">{s.count} rez</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-600" /> Kaynak Dağılımı
              </h3>
              {bySource.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">Veri yok</p>
              ) : (
                <div className="space-y-2">
                  {bySource.map(s => (
                    <div key={s.source}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700 dark:text-slate-300">{SOURCE_LABEL[s.source] || s.source}</span>
                        <span className="text-slate-600 dark:text-slate-400">{fmtTRY(s.revenue)}</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 dark:from-cyan-700 dark:to-cyan-500"
                          style={{ width: `${(s.revenue / maxSourceRev) * 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{s.count} rezervasyon</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Durum Özeti</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {byStatus.map(s => (
                <div key={s.status} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-slate-700 dark:text-slate-300">{STATUS_LABEL[s.status] || s.status}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{s.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Toplam {period.reservations_count} rezervasyon · {period.room_nights} satılan gece · {period.total_rooms} oda envanteri
            </div>
          </div>
        </>
      )}
    </div>
  );
}
