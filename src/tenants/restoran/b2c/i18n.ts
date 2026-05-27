/**
 * Restoran B2C çoklu dil — Butlaroo paterni.
 *
 * Restoran enabled_languages text[] ile aktif dillerini seçer.
 * translations jsonb: { en: { name, description }, nl: {...} } default dil
 * kolonun kendi name/description'ında.
 *
 * Resolver: locale verilirse translations[locale]?.name veya fallback default.
 *
 * Locale persistence: localStorage `restoran-lang-{slug}` (5 yıl).
 */

export const SUPPORTED_LANGUAGES = ["tr", "nl", "en", "fr", "de", "it"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, { name: string; flag: string }> = {
  tr: { name: "Türkçe", flag: "🇹🇷" },
  nl: { name: "Nederlands", flag: "🇳🇱" },
  en: { name: "English", flag: "🇬🇧" },
  fr: { name: "Français", flag: "🇫🇷" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  it: { name: "Italiano", flag: "🇮🇹" },
};

export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** Translations jsonb shape — { [lang]: { name, description } } */
export interface TranslationsBlock {
  name?: string;
  description?: string;
  [key: string]: string | undefined;
}

export type TranslationsMap = Partial<Record<SupportedLanguage, TranslationsBlock>>;

/**
 * Field resolver — locale verildiğinde önce translations[locale]?.[field]'a bakar,
 * yoksa fallback değeri döner.
 */
export function resolveTranslation(
  translations: TranslationsMap | null | undefined,
  field: "name" | "description",
  locale: SupportedLanguage | string | null | undefined,
  fallback: string | null,
): string | null {
  if (!locale || locale === "tr") return fallback;  // tr default — kolonun kendisi
  if (!translations) return fallback;
  const block = translations[locale as SupportedLanguage];
  const value = block?.[field];
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

/** localStorage key per restaurant */
function storageKey(slug: string): string {
  return `restoran-lang-${slug}`;
}

export function getStoredLanguage(slug: string): SupportedLanguage | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(storageKey(slug));
    if (v && isSupportedLanguage(v)) return v;
  } catch {
    /* sessiz */
  }
  return null;
}

export function setStoredLanguage(slug: string, lang: SupportedLanguage): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(slug), lang);
  } catch {
    /* sessiz */
  }
}
