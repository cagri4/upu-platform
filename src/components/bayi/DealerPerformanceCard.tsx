"use client";

/**
 * Bayi detay sayfası için "Performans" özet kartı.
 *
 * `/api/bayi-scoring/dealer/[id]` çağırır, son skor + 12-hafta trend
 * + alt-skor breakdown gösterir. Trend SVG sparkline (chart lib yok).
 *
 * Layout: tek satır 5 kolon — Total / Hacim / Düzenlilik / Tahsilat / Trend.
 * Alt: 12 hafta sparkline.
 */
import { useEffect, useState } from "react";

interface TrendPoint {
  period_start: string;
  total: number;
  volume: number;
  regularity: number;
  collection: number;
  trend: number;
}

interface Resp {
  latest: TrendPoint | null;
  trend: TrendPoint[];
  risk: {
    level: "ok" | "watch" | "risk";
    daysSinceLastOrder: number;
    maxOverdueDays: number;
  } | null;
}

interface Props { dealerId: string; token?: string }

function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-500";
  if (score >= 80) return "text-emerald-700";
  if (score >= 60) return "text-amber-700";
  if (score >= 40) return "text-orange-700";
  return "text-rose-700";
}

const RISK_META = {
  risk: { icon: "🔴", label: "Yüksek Risk", cls: "bg-rose-100 text-rose-800" },
  watch: { icon: "🟡", label: "Watch", cls: "bg-amber-100 text-amber-800" },
  ok: { icon: "🟢", label: "Sağlıklı", cls: "bg-emerald-100 text-emerald-800" },
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const w = 240;
  const h = 36;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full h-9">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points={pts} className="text-indigo-500" />
    </svg>
  );
}

export function DealerPerformanceCard({ dealerId, token = "" }: Props) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bayi-scoring/dealer/${dealerId}${qs}`, { credentials: "same-origin" })
      .then(r => {
        if (r.status === 403) { setHidden(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then(d => { if (d) setData(d); })
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [dealerId, token]);

  if (hidden || loading) return null;
  if (!data) return null;

  const latest = data.latest;
  const trendValues = data.trend.map(t => t.total);
  const risk = data.risk;

  return (
    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">📊 Performans Skoru</h3>
        {risk && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${RISK_META[risk.level].cls}`}>
            {RISK_META[risk.level].icon} {RISK_META[risk.level].label}
            {risk.level !== "ok" && risk.daysSinceLastOrder > 0 && ` · ${risk.daysSinceLastOrder}g`}
          </span>
        )}
      </div>

      {latest ? (
        <div className="grid grid-cols-5 gap-2 mb-3">
          <Stat label="Toplam" value={latest.total} highlight />
          <Stat label="Hacim" value={latest.volume} />
          <Stat label="Düzenlilik" value={latest.regularity} />
          <Stat label="Tahsilat" value={latest.collection} />
          <Stat label="Trend" value={latest.trend} />
        </div>
      ) : (
        <div className="text-xs text-slate-400 py-4 text-center">
          Yeterli veri yok — skor için 3 ay sipariş tarihçesi gerekir. Cron Pazartesi yenileyecek.
        </div>
      )}

      {trendValues.length > 1 && (
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Son {trendValues.length} hafta trend</div>
          <div className={scoreColor(latest?.total ?? null)}>
            <Sparkline values={trendValues} />
          </div>
        </div>
      )}
    </section>
  );

  function Stat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
    const cls = scoreColor(value);
    return (
      <div className={`text-center ${highlight ? "bg-slate-50 dark:bg-slate-900 rounded-lg p-2" : ""}`}>
        <div className={`text-[10px] uppercase tracking-wide ${highlight ? "text-slate-500" : "text-slate-400"}`}>{label}</div>
        <div className={`mt-0.5 font-bold ${highlight ? `text-2xl ${cls}` : `text-base ${cls}`}`}>{value}</div>
      </div>
    );
  }
}
