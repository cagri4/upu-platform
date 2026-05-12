"use client";

import type { LucideIcon } from "lucide-react";

export interface ActionCircleProps {
  Icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
}

export function ActionCircle({ Icon, label, href, onClick }: ActionCircleProps) {
  const inner = (
    <div className="flex flex-col items-center gap-2 min-w-[68px] group">
      <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 group-active:scale-95 transition">
        <Icon className="w-6 h-6" strokeWidth={2.2} />
      </div>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center leading-tight">
        {label}
      </span>
    </div>
  );

  if (href) return <a href={href}>{inner}</a>;
  if (onClick)
    return (
      <button type="button" onClick={onClick}>
        {inner}
      </button>
    );
  return inner;
}
