/**
 * Otel tenant KPI card catalog — server-safe (Lucide import yok).
 *
 * Otel panel ana sayfasındaki StatCard grid'i bu key seti üzerinden render
 * edilir. Kullanıcı tercihi profile.metadata.otel_panel_layout.kpi_cards
 * (string[]) — emlak/bayi panel_layout'tan ayrı (multi-tenant pattern).
 *
 * Anahtarlar /api/otel-panel/dashboard'tan dönen KPIs interface field
 * isimleriyle birebir eşleşir → catalog key → kpis[key] lookup.
 */

export type OtelKpiCardKey =
  | "occupancy_pct"
  | "reservations_week"
  | "today_checkin"
  | "today_checkout"
  | "monthly_revenue"
  | "precheckin_pending";

export const ALL_OTEL_KPI_CARD_KEYS: OtelKpiCardKey[] = [
  "occupancy_pct",
  "reservations_week",
  "today_checkin",
  "today_checkout",
  "monthly_revenue",
  "precheckin_pending",
];

/** Yeni kullanıcı default'u — 6 KPI hepsi açık (otel için catalog = default). */
export const DEFAULT_OTEL_KPI_CARDS: OtelKpiCardKey[] = [
  "occupancy_pct",
  "reservations_week",
  "today_checkin",
  "today_checkout",
  "monthly_revenue",
  "precheckin_pending",
];

export function sanitizeOtelKpiCards(input: unknown): OtelKpiCardKey[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set<string>(ALL_OTEL_KPI_CARD_KEYS);
  const out: OtelKpiCardKey[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    if (!valid.has(x)) continue;
    if (out.includes(x as OtelKpiCardKey)) continue;
    out.push(x as OtelKpiCardKey);
  }
  return out;
}
