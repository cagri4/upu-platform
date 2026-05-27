/**
 * Skeleton variantları — sayfa geçişlerinde spinner/kum saati yerine
 * banking placeholder yapısı. Çağrı 2026-05-27 onayı: "spinner KALDIR".
 *
 * Temel `Skeleton` zaten `./skeleton.tsx` içinde. Bu dosya composite
 * iskelet pattern'leri (dashboard / list / panel-shell) tanımlar.
 */

import { Skeleton } from "./skeleton";

/**
 * Dashboard placeholder — HeroBanner + Stat grid + Quick action row.
 * (site)/(panel)/(bayipanel)/(otel-panel) dashboard'ları için.
 */
export function SkeletonDashboard() {
  return (
    <div className="space-y-5 sm:space-y-6">
      {/* HeroBanner placeholder */}
      <Skeleton height="h-28" className="rounded-2xl" />

      {/* Quick action row */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-4">
        <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded mb-3 animate-pulse" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 min-w-[68px]">
              <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-2 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* KPI grid 2×3 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height="h-28" />
        ))}
      </div>
    </div>
  );
}

/**
 * List placeholder — HeroBanner + 5 ListCard satır.
 * (site)/site-sakinlerim, site-aidat, site-talepler vb. listeler için.
 */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <Skeleton height="h-28" className="rounded-2xl" />
      <div className="space-y-2">
        <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse px-1" />
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} height="h-16" />
        ))}
      </div>
    </div>
  );
}

/**
 * Panel shell placeholder — sidebar görünür kalır, content alanı için.
 * loading.tsx dosyalarında route group layout'unun çocuğu olarak render.
 */
export function SkeletonPanelShell() {
  return (
    <div className="space-y-5 sm:space-y-6 p-4 sm:p-6">
      <Skeleton height="h-28" className="rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height="h-28" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height="h-16" />
        ))}
      </div>
    </div>
  );
}

/**
 * Full-screen page placeholder (top-level loading.tsx) — minimal
 * cyan accent ile banking gray placeholder. Spinner YOK.
 */
export function SkeletonFullPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 space-y-5">
      <div className="max-w-3xl mx-auto space-y-5">
        <Skeleton height="h-28" className="rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="h-28" />
          ))}
        </div>
      </div>
    </div>
  );
}
