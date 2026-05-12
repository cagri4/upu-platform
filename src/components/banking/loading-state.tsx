"use client";

import { Loader2 } from "lucide-react";

export type LoadingStateVariant = "page" | "card" | "inline";

export interface LoadingStateProps {
  /** Spinner altında gösterilen metin. Default: "Yükleniyor". */
  label?: string;
  /**
   * - `page`  — Full-screen centered card (default). status="loading" return.
   * - `card`  — Page chrome içinde yer alan bir bölüm için (no min-h-screen).
   * - `inline` — Akış içinde küçük spinner + text (expand içeriği vb.).
   */
  variant?: LoadingStateVariant;
}

export function LoadingState({ label = "Yükleniyor", variant = "page" }: LoadingStateProps) {
  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
        <span>{label}</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">{label}</p>
      </div>
    );
  }

  // page variant — full-screen centered card (auth init, top-level page load)
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full shadow-sm border border-slate-200/70 dark:border-slate-800 flex flex-col items-center text-center">
        <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin mb-3" />
        <p className="text-slate-600 dark:text-slate-400 text-sm">{label}</p>
      </div>
    </div>
  );
}
