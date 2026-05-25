"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

export interface InfoChipProps {
  Icon: LucideIcon;
  text: string;
  tone?: "amber" | "emerald" | "rose" | "slate";
  href?: string;
  onClick?: () => void;
}

const TONE: Record<NonNullable<InfoChipProps["tone"]>, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-600 dark:text-rose-400",
  slate: "text-slate-500 dark:text-slate-400",
};

export function InfoChip({ Icon, text, tone = "amber", href, onClick }: InfoChipProps) {
  const inner = (
    <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-[0.99] transition">
      <Icon className={`w-5 h-5 flex-shrink-0 ${TONE[tone]}`} strokeWidth={2.2} />
      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200">{text}</span>
      <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
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
