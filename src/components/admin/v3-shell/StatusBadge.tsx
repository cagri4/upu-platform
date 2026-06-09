/**
 * V3 StatusBadge — ring-1 inset, küçük chip.
 *
 * Tone palette: success (yeşil), warning (amber), danger (kırmızı),
 * info (mavi), neutral (gri).
 */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface StatusBadgeProps {
  tone: StatusTone;
  children: React.ReactNode;
}

const TONE_CLS: Record<StatusTone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  neutral: "bg-slate-50 text-slate-700 ring-slate-200",
};

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLS[tone]}`}
    >
      {children}
    </span>
  );
}
