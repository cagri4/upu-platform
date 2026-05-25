"use client";

import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  value: string | number;
  label: string;
  Icon?: LucideIcon;
  trend?: { text: string; positive?: boolean };
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({ value, label, Icon, trend, href, onClick, className = "" }: StatCardProps) {
  const inner = (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-[0.98] transition flex flex-col gap-2 h-full ${className}`}
    >
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>
      )}
      <div className="text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
        {value}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</div>
      {trend && (
        <div
          className={`text-xs font-semibold flex items-center gap-1 mt-auto ${
            trend.positive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          <span aria-hidden="true">{trend.positive ? "▲" : "▼"}</span>
          <span>{trend.text}</span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block h-full">
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left h-full">
        {inner}
      </button>
    );
  }
  return inner;
}
