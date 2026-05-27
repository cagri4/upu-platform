"use client";

/**
 * B2C Sepet React context — /r/{slug} sayfalarında paylaşılır state.
 *
 * localStorage anahtarı: `restoran-cart-{slug}` (her restoran ayrı sepet).
 * SSR-safe: useEffect ile hydrate, ilk render'da boş döner.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Cart, CartItem } from "./cart-types";
import { makeItemKey } from "./cart-types";

interface CartContextValue {
  cart: Cart;
  hydrated: boolean;
  addItem: (
    item: Omit<CartItem, "key" | "quantity"> & { quantity?: number },
  ) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  setNotes: (key: string, notes: string | null) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(slug: string): string {
  return `restoran-cart-${slug}`;
}

function loadCart(slug: string): Cart {
  if (typeof window === "undefined") return { restaurantSlug: slug, items: [] };
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return { restaurantSlug: slug, items: [] };
    const parsed = JSON.parse(raw) as Cart;
    if (parsed.restaurantSlug !== slug || !Array.isArray(parsed.items)) {
      return { restaurantSlug: slug, items: [] };
    }
    return parsed;
  } catch {
    return { restaurantSlug: slug, items: [] };
  }
}

function persistCart(cart: Cart): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(cart.restaurantSlug), JSON.stringify(cart));
  } catch {
    /* quota / private mode — sessiz */
  }
}

export function CartProvider({
  children,
  restaurantSlug,
}: {
  children: React.ReactNode;
  restaurantSlug: string;
}) {
  const [cart, setCart] = useState<Cart>({ restaurantSlug, items: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(loadCart(restaurantSlug));
    setHydrated(true);
  }, [restaurantSlug]);

  useEffect(() => {
    if (hydrated) persistCart(cart);
  }, [cart, hydrated]);

  const addItem = useCallback<CartContextValue["addItem"]>((input) => {
    const addonIds = (input.addons || []).map((a) => a.id);
    const key = makeItemKey(input.menuItemId, input.variant?.id || null, addonIds);
    const quantity = input.quantity ?? 1;

    setCart((prev) => {
      const existingIdx = prev.items.findIndex((i) => i.key === key);
      if (existingIdx >= 0) {
        // Aynı kombinasyon — sadece quantity arttır
        const next = [...prev.items];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + quantity,
        };
        return { ...prev, items: next };
      }
      const newItem: CartItem = {
        key,
        menuItemId: input.menuItemId,
        name: input.name,
        imageUrl: input.imageUrl,
        basePrice: input.basePrice,
        variant: input.variant,
        addons: input.addons,
        quantity,
        notes: input.notes ?? null,
      };
      return { ...prev, items: [...prev.items, newItem] };
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.key !== key) }));
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    if (quantity < 1) {
      setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.key !== key) }));
      return;
    }
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
    }));
  }, []);

  const setNotes = useCallback((key: string, notes: string | null) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.key === key ? { ...i, notes } : i)),
    }));
  }, []);

  const clear = useCallback(() => {
    setCart({ restaurantSlug, items: [] });
  }, [restaurantSlug]);

  const value = useMemo(
    () => ({ cart, hydrated, addItem, removeItem, setQuantity, setNotes, clear }),
    [cart, hydrated, addItem, removeItem, setQuantity, setNotes, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
