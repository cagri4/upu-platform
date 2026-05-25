"use client";

import type { LucideIcon } from "lucide-react";

export interface ActionCircleProps {
  Icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
}

export function ActionCircle({ Icon, label, href, onClick, external }: ActionCircleProps) {
  const inner = (
    <div className="flex flex-col items-center gap-2 min-w-[68px] group">
      <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 group-active:scale-95 transition">
        <Icon className="w-6 h-6" strokeWidth={2.2} />
      </div>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center leading-tight">
        {label}
      </span>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
      >
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick}>
        {inner}
      </button>
    );
  }
  return inner;
}
