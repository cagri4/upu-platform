/**
 * Hızlı işlem catalog — server-safe (Lucide import yok).
 *
 * Panel ana sayfasındaki yatay scroll row + Panel Ayarları'ndaki
 * yönetim ekranı bu key seti üzerinden çalışır. Kullanıcı tercihi
 * `profiles.metadata.quick_actions` (string[]) olarak tutulur.
 */

export type QuickActionKey =
  | "mulk_ekle"
  | "musteri_ekle"
  | "sozlesme_yap"
  | "sunum_yarat"
  | "takip_ekle"
  | "hatirlatma"
  | "pazar_tara"
  | "eklenti";

export const ALL_QUICK_ACTION_KEYS: QuickActionKey[] = [
  "mulk_ekle",
  "musteri_ekle",
  "sozlesme_yap",
  "sunum_yarat",
  "takip_ekle",
  "hatirlatma",
  "pazar_tara",
  "eklenti",
];

/** Yeni kullanıcı default'u — ilk 6, Faz 1 panel sayfası hardcode set ile birebir. */
export const DEFAULT_QUICK_ACTIONS: QuickActionKey[] = [
  "mulk_ekle",
  "musteri_ekle",
  "sozlesme_yap",
  "sunum_yarat",
  "takip_ekle",
  "hatirlatma",
];

/**
 * Bilinmeyen anahtarları at, duplicate'leri at. null dönmek input
 * geçersiz format (array değil) demektir; çağıran 400 dönmeli.
 */
export function sanitizeQuickActions(input: unknown): QuickActionKey[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set<string>(ALL_QUICK_ACTION_KEYS);
  const out: QuickActionKey[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    if (!valid.has(x)) continue;
    if (out.includes(x as QuickActionKey)) continue;
    out.push(x as QuickActionKey);
  }
  return out;
}
