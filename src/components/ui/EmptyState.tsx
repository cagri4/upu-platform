/**
 * Reusable empty-state component.
 *
 * Liste/grid sayfalarında veri olmadığında gösterilen yönlendirici
 * görsel. Pattern: ikon + başlık + 1-2 cümle açıklama + birincil CTA
 * (opsiyonel) + ikincil link (opsiyonel).
 *
 * Mobile-first; max-width: 28rem ortalı.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export interface EmptyStateCta {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface EmptyStateProps {
  icon?: LucideIcon | string;
  title: string;
  description?: string;
  cta?: EmptyStateCta;
  secondary?: EmptyStateCta;
  accent?: string;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  cta,
  secondary,
  accent = "indigo",
  className = "",
}: EmptyStateProps) {
  const accentBg = ACCENT_BG[accent] || ACCENT_BG.indigo;
  const accentRing = ACCENT_RING[accent] || ACCENT_RING.indigo;

  const IconComponent = typeof icon === "function" ? icon : null;
  const emojiIcon = typeof icon === "string" ? icon : null;

  return (
    <div className={`flex flex-col items-center justify-center text-center px-4 py-10 ${className}`}>
      <div className={`w-16 h-16 rounded-full ${accentBg} ${accentRing} flex items-center justify-center mb-4`}>
        {IconComponent ? (
          <IconComponent className="w-7 h-7" strokeWidth={1.8} />
        ) : emojiIcon ? (
          <span className="text-3xl leading-none">{emojiIcon}</span>
        ) : (
          <Inbox className="w-7 h-7 text-slate-400" strokeWidth={1.8} />
        )}
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {cta && (
        cta.href ? (
          <Link href={cta.href}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm ${ACCENT_BUTTON[accent] || ACCENT_BUTTON.indigo}`}>
            {cta.label}
          </Link>
        ) : (
          <button onClick={cta.onClick}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm ${ACCENT_BUTTON[accent] || ACCENT_BUTTON.indigo}`}>
            {cta.label}
          </button>
        )
      )}
      {secondary && (
        secondary.href ? (
          <Link href={secondary.href}
            className="mt-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline-offset-2 hover:underline">
            {secondary.label}
          </Link>
        ) : (
          <button onClick={secondary.onClick}
            className="mt-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline-offset-2 hover:underline">
            {secondary.label}
          </button>
        )
      )}
    </div>
  );
}

const ACCENT_BG: Record<string, string> = {
  indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300",
  emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300",
  amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300",
  rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300",
  slate: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300",
};

const ACCENT_RING: Record<string, string> = {
  indigo: "ring-1 ring-indigo-100 dark:ring-indigo-800/50",
  emerald: "ring-1 ring-emerald-100 dark:ring-emerald-800/50",
  amber: "ring-1 ring-amber-100 dark:ring-amber-800/50",
  rose: "ring-1 ring-rose-100 dark:ring-rose-800/50",
  slate: "ring-1 ring-slate-200 dark:ring-slate-700",
};

const ACCENT_BUTTON: Record<string, string> = {
  indigo: "bg-indigo-600 hover:bg-indigo-700",
  emerald: "bg-emerald-600 hover:bg-emerald-700",
  amber: "bg-amber-600 hover:bg-amber-700",
  rose: "bg-rose-600 hover:bg-rose-700",
  slate: "bg-slate-700 hover:bg-slate-800",
};
