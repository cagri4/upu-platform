/**
 * Bayi tenant KPI card catalog — server-safe (Lucide import yok).
 *
 * Bayi panel ana sayfasındaki StatCard grid'i bu key seti üzerinden render
 * edilir. Kullanıcı tercihi profile.metadata.bayi_panel_layout.kpi_cards
 * (string[]) — emlak panel_layout'tan ayrı (multi-tenant pattern).
 *
 * Anahtarlar /api/bayi-panel/dashboard'tan dönen KPIs interface field
 * isimleriyle birebir eşleşir → catalog key → kpis[key] lookup.
 */

export type BayiKpiCardKey =
  | "dealer_count"
  | "active_orders"
  | "pending_invoices"
  | "overdue_amount"
  | "month_revenue"
  | "critical_stock"
  | "active_invites";

export const ALL_BAYI_KPI_CARD_KEYS: BayiKpiCardKey[] = [
  "dealer_count",
  "active_orders",
  "overdue_amount",
  "month_revenue",
  "critical_stock",
  "active_invites",
  "pending_invoices",
];

/** Yeni kullanıcı default'u — ilk 6 (pending_invoices customize'da seçilebilir). */
export const DEFAULT_BAYI_KPI_CARDS: BayiKpiCardKey[] = [
  "dealer_count",
  "active_orders",
  "overdue_amount",
  "month_revenue",
  "critical_stock",
  "active_invites",
];

export function sanitizeBayiKpiCards(input: unknown): BayiKpiCardKey[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set<string>(ALL_BAYI_KPI_CARD_KEYS);
  const out: BayiKpiCardKey[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    if (!valid.has(x)) continue;
    if (out.includes(x as BayiKpiCardKey)) continue;
    out.push(x as BayiKpiCardKey);
  }
  return out;
}
