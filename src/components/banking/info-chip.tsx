"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

export interface InfoChipProps {
  Icon: LucideIcon;
  text: string;
  href?: string;
  onClick?: () => void;
}

export function InfoChip({ Icon, text, href, onClick }: InfoChipProps) {
  const inner = (
    <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-[0.99] transition">
      <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={2.2} />
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
