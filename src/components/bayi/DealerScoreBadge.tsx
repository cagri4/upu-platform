"use client";

/**
 * Bayi performans skor rozeti — 0-100 renk kodlu pill.
 *
 * Renk eşikleri:
 *   80+   yeşil — yüksek performans
 *   60-79 sarı  — orta
 *   40-59 turuncu — düşük
 *   0-39  kırmızı — zayıf
 *   null  gri — "yeterli veri yok"
 *
 * Tooltip varsa breakdown (sub-volume/regularity/collection/trend).
 */
import { useState } from "react";

interface SubScores {
  volume: number;
  regularity: number;
  collection: number;
  trend: number;
}

interface Props {
  score: number | null;
  sub?: SubScores;
  size?: "sm" | "md";
  className?: string;
}

function scoreClass(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-500 border-slate-200";
  if (score >= 80)    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (score >= 60)    return "bg-amber-100 text-amber-800 border-amber-300";
  if (score >= 40)    return "bg-orange-100 text-orange-800 border-orange-300";
  return "bg-rose-100 text-rose-800 border-rose-300";
}

export function DealerScoreBadge({ score, sub, size = "md", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const cls = scoreClass(score);
  const display = score === null ? "—" : String(score);
  const sz = size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-0.5 font-semibold";

  return (
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={`inline-flex items-center gap-1 rounded-full border ${cls} ${sz}`}
        title={score === null ? "Yeterli veri yok — 3 ay sipariş tarihçesi gerekli" : `Skor: ${score}`}
      >
        {display}
        {sub && <span className="opacity-60">›</span>}
      </button>
      {open && sub && (
        <span className="absolute z-20 top-full mt-1 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3 min-w-[180px] text-xs">
          <SubRow label="📊 Hacim" value={sub.volume} />
          <SubRow label="📅 Düzenlilik" value={sub.regularity} />
          <SubRow label="💰 Tahsilat" value={sub.collection} />
          <SubRow label="📈 Trend" value={sub.trend} />
        </span>
      )}
    </span>
  );
}

function SubRow({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex justify-between items-center py-0.5 text-slate-700 dark:text-slate-300">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
