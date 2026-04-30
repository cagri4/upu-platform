/**
 * Multi-currency formatting utility.
 *
 * Tenant başına default currency seçilebilir; her sipariş kendi para birimini
 * tutabilir; format çıktısı locale'e göre değişir (₺/€/$/£ symbol + binlik
 * ayraç + ondalık format).
 */

export type SupportedCurrency = "EUR" | "TRY" | "USD" | "GBP";
export type SupportedLocale = "tr-TR" | "tr-NL" | "nl-NL" | "en-US" | "en-GB";

const SYMBOLS: Record<SupportedCurrency, string> = {
  EUR: "€",
  TRY: "₺",
  USD: "$",
  GBP: "£",
};

const DEFAULT_CURRENCY: SupportedCurrency = "EUR";
const DEFAULT_LOCALE: SupportedLocale = "tr-NL";

/**
 * Format a numeric amount with currency symbol.
 *
 * Symbol position follows currency convention: € and ₺ post-fix, $ and £ pre-fix.
 *
 * @example
 *   formatCurrency(1500)                        → "1.500 €"
 *   formatCurrency(1500, "TRY", "tr-TR")        → "1.500 ₺"
 *   formatCurrency(1500, "USD", "en-US")        → "$1,500"
 */
export function formatCurrency(
  amount: number,
  currency: SupportedCurrency = DEFAULT_CURRENCY,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const symbol = SYMBOLS[currency];
  const formatted = amount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return currency === "USD" || currency === "GBP" ? `${symbol}${formatted}` : `${formatted} ${symbol}`;
}

/**
 * Pick the right symbol for a currency without formatting an amount.
 */
export function currencySymbol(currency: SupportedCurrency = DEFAULT_CURRENCY): string {
  return SYMBOLS[currency];
}
