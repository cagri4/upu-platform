/**
 * Bayi portal localStorage sepet — Sprint B'de UI hızlı feedback için.
 * Sprint C'de bayi_carts DB tablosuna senkron edilir; bu modül o aşamada
 * "DB-first + localStorage cache" pattern'iyle güncellenecek.
 *
 * Format: { lines: [{productId, quantity, addedAt, productName, productCode,
 *                    unit, basePrice, listUnitPrice, imageUrl }] }
 */

export interface CartLine {
  productId: string;
  productName: string;
  productCode: string;
  unit: string;
  basePrice: number;
  listUnitPrice: number;
  imageUrl: string | null;
  quantity: number;
  addedAt: string;
}

interface CartState {
  lines: CartLine[];
}

const STORAGE_KEY = "upu-bayi-cart";

function safeRead(): CartState {
  if (typeof window === "undefined") return { lines: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lines: [] };
    const parsed = JSON.parse(raw) as CartState;
    if (!Array.isArray(parsed.lines)) return { lines: [] };
    return parsed;
  } catch {
    return { lines: [] };
  }
}

function safeWrite(state: CartState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("upu-cart-changed"));
  } catch {
    // localStorage dolu/özel mod — sessiz geç
  }
}

export function getCart(): CartState {
  return safeRead();
}

export function getCartCount(): number {
  return safeRead().lines.reduce((s, l) => s + l.quantity, 0);
}

export function addToCart(
  line: Omit<CartLine, "addedAt" | "quantity"> & { quantity?: number },
): CartState {
  const state = safeRead();
  const qty = Math.max(1, line.quantity ?? 1);
  const existing = state.lines.find((l) => l.productId === line.productId);
  if (existing) {
    existing.quantity += qty;
    existing.listUnitPrice = line.listUnitPrice;
  } else {
    state.lines.push({
      productId: line.productId,
      productName: line.productName,
      productCode: line.productCode,
      unit: line.unit,
      basePrice: line.basePrice,
      listUnitPrice: line.listUnitPrice,
      imageUrl: line.imageUrl,
      quantity: qty,
      addedAt: new Date().toISOString(),
    });
  }
  safeWrite(state);
  return state;
}

export function updateQuantity(productId: string, quantity: number): CartState {
  const state = safeRead();
  const line = state.lines.find((l) => l.productId === productId);
  if (!line) return state;
  if (quantity <= 0) {
    return removeFromCart(productId);
  }
  line.quantity = quantity;
  safeWrite(state);
  return state;
}

export function removeFromCart(productId: string): CartState {
  const state = safeRead();
  state.lines = state.lines.filter((l) => l.productId !== productId);
  safeWrite(state);
  return state;
}

export function clearCart(): void {
  safeWrite({ lines: [] });
}
