"use client";

import type { LucideIcon } from "lucide-react";

export interface HeroBannerProps {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  Icon?: LucideIcon;
}

export function HeroBanner({ title, subtitle, ctaLabel, ctaHref, ctaOnClick, Icon }: HeroBannerProps) {
  const cta = ctaLabel
    ? ctaHref
      ? (
          <a
            href={ctaHref}
            className="inline-flex items-center mt-4 bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95"
          >
            {ctaLabel}
          </a>
        )
      : (
          <button
            type="button"
            onClick={ctaOnClick}
            className="inline-flex items-center mt-4 bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95"
          >
            {ctaLabel}
          </button>
        )
    : null;

  return (
    <div className="bg-emerald-600 dark:bg-emerald-700 text-white rounded-2xl p-5 sm:p-6 shadow-md">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6" strokeWidth={2.2} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-emerald-50/90 text-sm mt-1.5 leading-relaxed">{subtitle}</p>
          )}
          {cta}
        </div>
      </div>
    </div>
  );
}
