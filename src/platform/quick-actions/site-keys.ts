/**
 * Siteyönetim tenant Hızlı İşlem catalog — server-safe (Lucide import yok).
 *
 * Site panel ana sayfasındaki yatay scroll row + Site panel-ayarları
 * customize bölümü bu key seti üzerinden çalışır. Kullanıcı tercihi
 * profile.metadata.site_panel_layout.quick_actions (string[]).
 *
 * Bayi/emlak `keys.ts` ile paritetik — sadece key seti + DEFAULT site-spesifik.
 */

export type SiteQuickActionKey =
  | "duyuru_gonder"
  | "bina_kodu"
  | "aidat_yonetim"
  | "ariza_bildir"
  | "rapor_aylik"
  | "sakin_listele"
  | "tahsilat_kaydet";

export const ALL_SITE_QUICK_ACTION_KEYS: SiteQuickActionKey[] = [
  "duyuru_gonder",
  "bina_kodu",
  "aidat_yonetim",
  "ariza_bildir",
  "rapor_aylik",
  "sakin_listele",
  "tahsilat_kaydet",
];

/** Yeni kullanıcı default'u — ilk 4 görünür, gerisi customize'da seçilebilir. */
export const DEFAULT_SITE_QUICK_ACTIONS: SiteQuickActionKey[] = [
  "duyuru_gonder",
  "bina_kodu",
  "aidat_yonetim",
  "ariza_bildir",
];

export function sanitizeSiteQuickActions(input: unknown): SiteQuickActionKey[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set<string>(ALL_SITE_QUICK_ACTION_KEYS);
  const out: SiteQuickActionKey[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    if (!valid.has(x)) continue;
    if (out.includes(x as SiteQuickActionKey)) continue;
    out.push(x as SiteQuickActionKey);
  }
  return out;
}
