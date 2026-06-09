/**
 * V3 KPICard — dashboard 4'lü grid item'ı.
 *
 * 2 satır: üst (label + delta), büyük rakam, alt açıklama.
 */

export interface KPICardProps {
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  deltaTone?: "positive" | "warning" | "danger" | "neutral";
}

const TONE: Record<NonNullable<KPICardProps["deltaTone"]>, string> = {
  positive: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
  neutral: "text-slate-500",
};

export function KPICard({ label, value, hint, delta, deltaTone = "neutral" }: KPICardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
        {delta && (
          <span className={`text-xs font-semibold tabular-nums ${TONE[deltaTone]}`}>{delta}</span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
