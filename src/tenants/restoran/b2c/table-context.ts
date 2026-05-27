/**
 * Masa context — QR'dan gelen müşterinin masa bilgisi.
 *
 * Persistence: localStorage `restoran-table-{slug}` (per-restaurant).
 * URL fallback: `?table={qr_token}` query param (localStorage temizlenirse).
 *
 * Flow:
 *   1. Müşteri /r/{slug}/m/{qr_token} URL'sini ziyaret eder
 *   2. Sunucu qr_token → masa lookup yapar (server component)
 *   3. setTableContext() ile localStorage'a yazılır
 *   4. /menu, /sepet, /siparis sayfaları getTableContext() ile okur
 *   5. Sepette delivery_type='dine_in' otomatik, ödeme 'dine_in_later' default
 *
 * Süre: 4 saat (masada kalma süresi). 4 saat sonra otomatik temizlenir.
 */

const TTL_HOURS = 4;

export interface TableContext {
  tableId: string;
  qrToken: string;
  tableLabel: string;
  capacity: number | null;
  zone: string | null;
  enteredAt: number;  // Date.now() ms
}

function storageKey(slug: string): string {
  return `restoran-table-${slug}`;
}

export function setTableContext(slug: string, ctx: Omit<TableContext, "enteredAt">): void {
  if (typeof window === "undefined") return;
  try {
    const value: TableContext = { ...ctx, enteredAt: Date.now() };
    window.localStorage.setItem(storageKey(slug), JSON.stringify(value));
  } catch {
    /* quota / private mode — sessiz */
  }
}

export function getTableContext(slug: string): TableContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const ctx = JSON.parse(raw) as TableContext;
    if (!ctx.tableId || !ctx.qrToken) return null;
    // TTL check
    const ageHours = (Date.now() - ctx.enteredAt) / 1000 / 60 / 60;
    if (ageHours > TTL_HOURS) {
      window.localStorage.removeItem(storageKey(slug));
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

export function clearTableContext(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(slug));
  } catch {
    /* sessiz */
  }
}
