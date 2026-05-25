/**
 * Otel tenant Hızlı İşlem catalog — server-safe (Lucide import yok).
 *
 * Otel panel ana sayfasındaki yatay scroll row + customize bölümü bu key
 * seti üzerinden çalışır. Kullanıcı tercihi
 * `profiles.metadata.otel_panel_layout.quick_actions` (string[]).
 */

export type OtelQuickActionKey =
  | "rezervasyonlar"
  | "konuklar"
  | "odalar"
  | "takvim"
  | "odemeler"
  | "mesajlar"
  | "calisan_davet";

export const ALL_OTEL_QUICK_ACTION_KEYS: OtelQuickActionKey[] = [
  "rezervasyonlar",
  "konuklar",
  "odalar",
  "takvim",
  "odemeler",
  "mesajlar",
  "calisan_davet",
];

/** Yeni kullanıcı default'u — ilk 6, customize ile değiştirilebilir. */
export const DEFAULT_OTEL_QUICK_ACTIONS: OtelQuickActionKey[] = [
  "rezervasyonlar",
  "konuklar",
  "odalar",
  "takvim",
  "odemeler",
  "mesajlar",
];

export function sanitizeOtelQuickActions(input: unknown): OtelQuickActionKey[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set<string>(ALL_OTEL_QUICK_ACTION_KEYS);
  const out: OtelQuickActionKey[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    if (!valid.has(x)) continue;
    if (out.includes(x as OtelQuickActionKey)) continue;
    out.push(x as OtelQuickActionKey);
  }
  return out;
}
