/**
 * Multi-locale date formatting utility.
 *
 * Tenant default locale ile çalışır; per-user override desteği için locale
 * parametre alır. tr-NL hibrit: dil Türkçe ama tarih NL biçiminde (1 Mei 2026
 * yerine 1 Mayıs 2026, ama gün/ay sırası NL kuralında).
 */

import type { SupportedLocale } from "./currency";

const DEFAULT_LOCALE: SupportedLocale = "tr-NL";

/**
 * Today, long form: "1 Mayıs 2026"
 */
export function today(locale: SupportedLocale = DEFAULT_LOCALE): string {
  return new Date().toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Long form date: "1 Mayıs 2026"
 */
export function formatDate(dateStr: string, locale: SupportedLocale = DEFAULT_LOCALE): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Short numeric: "01.05" (TR) / "01-05" (NL) / "05/01" (US)
 */
export function shortDate(dateStr: string, locale: SupportedLocale = DEFAULT_LOCALE): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
  });
}
