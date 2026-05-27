/**
 * B2C Sepet tipleri — paylaşılır types (client + server).
 */

export interface CartAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartVariant {
  id: string;
  name: string;
  priceDiff: number;
}

export interface CartItem {
  /** Stable key — menuItemId + variantId + addon IDs hash */
  key: string;
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  variant: CartVariant | null;
  addons: CartAddon[];
  quantity: number;
  notes: string | null;
}

export interface Cart {
  restaurantSlug: string;
  items: CartItem[];
}

/** Bir kalemin toplam fiyatı (variant + addons × quantity) */
export function lineTotal(item: CartItem): number {
  const unit =
    item.basePrice +
    (item.variant?.priceDiff || 0) +
    item.addons.reduce((s, a) => s + a.price, 0);
  return Math.round(unit * item.quantity * 100) / 100;
}

/** Sepet kalemler toplamı */
export function cartSubtotal(items: CartItem[]): number {
  return Math.round(items.reduce((s, i) => s + lineTotal(i), 0) * 100) / 100;
}

/** Sepet adet toplamı (kalem değil, miktar toplamı — sticky bar 'X ürün') */
export function cartItemCount(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

/** Sepet kalem için stable key — varyant + addon kombinasyonuna göre */
export function makeItemKey(
  menuItemId: string,
  variantId: string | null,
  addonIds: string[],
): string {
  const sortedAddons = [...addonIds].sort().join(",");
  return `${menuItemId}::${variantId || "_"}::${sortedAddons}`;
}
