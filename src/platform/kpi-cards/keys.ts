/**
 * KPI card catalog — server-safe (Lucide import yok).
 *
 * Panel ana sayfasındaki StatCard grid'i bu key seti üzerinden render
 * edilir. Kullanıcı tercihi `profiles.metadata.panel_layout.kpi_cards`
 * (string[]) olarak tutulur. Default null → ALL_KPI_CARD_KEYS'in tümü
 * görünür (geri uyum).
 *
 * Anahtarlar /api/panel/dashboard'tan dönen KPIs interface field
 * isimleriyle birebir eşleşir — bu sayede catalog key → kpis[key]
 * lookup'ı yapılabilir.
 */

export type KpiCardKey =
  | "properties"
  | "customers"
  | "contracts"
  | "tracking"
  | "presentations"
  | "calendar";

export const ALL_KPI_CARD_KEYS: KpiCardKey[] = [
  "properties",
  "customers",
  "contracts",
  "tracking",
  "presentations",
  "calendar",
];

/** Yeni kullanıcı default'u — tüm 6 kart görünür. */
export const DEFAULT_KPI_CARDS: KpiCardKey[] = [...ALL_KPI_CARD_KEYS];

export function sanitizeKpiCards(input: unknown): KpiCardKey[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set<string>(ALL_KPI_CARD_KEYS);
  const out: KpiCardKey[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    if (!valid.has(x)) continue;
    if (out.includes(x as KpiCardKey)) continue;
    out.push(x as KpiCardKey);
  }
  return out;
}
