"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

export interface ListCardProps {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  rightLabel?: string;
  rightTone?: "amber" | "emerald" | "rose" | "slate";
  href?: string;
  onClick?: () => void;
}

const TONE: Record<NonNullable<ListCardProps["rightTone"]>, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  slate: "text-slate-500 dark:text-slate-400",
};

export function ListCard({
  Icon,
  title,
  subtitle,
  rightLabel,
  rightTone = "amber",
  href,
  onClick,
}: ListCardProps) {
  const inner = (
    <div className="bg-white dark:bg-slate-900 rounded-2xl px-4 py-3.5 border border-slate-200/70 dark:border-slate-800 hover:shadow-md active:scale-[0.99] transition flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5" strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{subtitle}</div>
        )}
      </div>
      {rightLabel && (
        <span className={`text-xs font-semibold ${TONE[rightTone]}`}>
          {rightLabel}
        </span>
      )}
      <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}
