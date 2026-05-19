/**
 * Bayi tenant Hızlı İşlem catalog — server-safe (Lucide import yok).
 *
 * Bayi panel ana sayfasındaki yatay scroll row + Bayi Panel Ayarları
 * customize bölümü bu key seti üzerinden çalışır. Kullanıcı tercihi
 * `profiles.metadata.bayi_quick_actions` (string[]) olarak tutulur.
 *
 * Emlak `keys.ts` ile paritetik — sadece key seti + DEFAULT bayi-spesifik.
 */

export type BayiQuickActionKey =
  | "bayi_davet"
  | "kullanici_ekle"
  | "siparis_kaydet"
  | "tahsilat"
  | "kampanya"
  | "vade_hatirla"
  | "cirolarim";

export const ALL_BAYI_QUICK_ACTION_KEYS: BayiQuickActionKey[] = [
  "bayi_davet",
  "kullanici_ekle",
  "siparis_kaydet",
  "tahsilat",
  "kampanya",
  "vade_hatirla",
  "cirolarim",
];

/** Yeni kullanıcı default'u — ilk 6, customize ile değiştirilebilir. */
export const DEFAULT_BAYI_QUICK_ACTIONS: BayiQuickActionKey[] = [
  "bayi_davet",
  "kullanici_ekle",
  "siparis_kaydet",
  "tahsilat",
  "kampanya",
  "vade_hatirla",
];

export function sanitizeBayiQuickActions(input: unknown): BayiQuickActionKey[] | null {
  if (!Array.isArray(input)) return null;
  const valid = new Set<string>(ALL_BAYI_QUICK_ACTION_KEYS);
  const out: BayiQuickActionKey[] = [];
  for (const x of input) {
    if (typeof x !== "string") continue;
    if (!valid.has(x)) continue;
    if (out.includes(x as BayiQuickActionKey)) continue;
    out.push(x as BayiQuickActionKey);
  }
  return out;
}
