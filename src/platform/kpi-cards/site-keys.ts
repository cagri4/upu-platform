/**
 * Siteyönetim tenant KPI card catalog — server-safe (Lucide import yok).
 *
 * Site panel ana sayfasındaki StatCard grid'i bu key seti üzerinden render
 * edilir. Kullanıcı tercihi profile.metadata.site_panel_layout.kpi_cards
 * (string[]) — bayi/emlak panel_layout'tan ayrı.
 *
 * Anahtarlar /api/site/dashboard'tan dönen KPIs interface field
 * isimleriyle birebir eşleşir → catalog key → kpis[key] lookup.
 */

export type SiteKpiCardKey =
  | "payment_due_units"
  | "open_complaints"
  | "active_residents"
  | "monthly_dues_collected"
  | "total_units"
  | "overdue_amount"
  | "occupancy_rate";

export const ALL_SITE_KPI_CARD_KEYS: SiteKpiCardKey[] = [
  "payment_due_units",
  "open_complaints",
  "active_residents",
  "monthly_dues_collected",
  "total_units",
  "overdue_amount",
  "occupancy_rate",
];

/** Yeni kullanıcı default'u — ilk 6 (occupancy_rate customize'da seçilebilir). */
export const DEFAULT_SITE_KPI_CARDS: SiteKpiCardKey[] = [
  "payment_due_units",
  "open_complaints",
  "active_residents",
  "monthly_dues_collected",
  "total_units",
  "overdue_amount",
];

export function sanitizeSiteKpiCards(input: unknown): SiteKpiCardKey[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set<string>(ALL_SITE_KPI_CARD_KEYS);
  const out: SiteKpiCardKey[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    if (!valid.has(x)) continue;
    if (out.includes(x as SiteKpiCardKey)) continue;
    out.push(x as SiteKpiCardKey);
  }
  return out;
}
