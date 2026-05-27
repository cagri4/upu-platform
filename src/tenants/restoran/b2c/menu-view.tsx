"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Minus,
  X,
  ShoppingBag,
  Leaf,
  Flame,
  AlertTriangle,
  UtensilsCrossed,
  Clock,
  Sparkles,
} from "lucide-react";
import { useCart } from "./cart-context";
import { cartItemCount, cartSubtotal } from "./cart-types";
import { useTableContext } from "./use-table-context";
import { TableActionsBar } from "./table-actions-bar";
import { LanguagePicker } from "./language-picker";
import { resolveTranslation, type SupportedLanguage, type TranslationsMap } from "./i18n";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  translations?: TranslationsMap | null;
}

export interface MenuItemFull {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  price: number;
  imageUrl: string | null;
  allergens: string[];
  calories: number | null;
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  prepMinutes: number | null;
  isAvailable: boolean;
  variants: Array<{ id: string; name: string; priceDiff: number; isDefault: boolean }>;
  addons: Array<{ id: string; name: string; price: number }>;
  translations?: TranslationsMap | null;
  upsellIds?: string[];
}

function fmtEur(n: number, opts?: { decimals?: number }): string {
  const decimals = opts?.decimals ?? (Math.abs(n) < 100 ? 2 : 0);
  return `€${n.toLocaleString("tr-NL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function MenuView({
  locale,
  slug,
  brandName,
  primaryColor,
  categories,
  items,
  menuGreeting,
  enabledLanguages,
  defaultLanguage,
}: {
  locale: string;
  slug: string;
  brandName: string;
  primaryColor: string;
  categories: Category[];
  items: MenuItemFull[];
  menuGreeting?: string | null;
  enabledLanguages?: string[];
  defaultLanguage?: string;
}) {
  const { cart, hydrated } = useCart();
  const { tableContext } = useTableContext(slug);
  const [uiLang, setUiLang] = useState<SupportedLanguage>("tr");
  const [upsellFor, setUpsellFor] = useState<MenuItemFull | null>(null);

  // Lokalize edilmiş kategoriler + item'lar
  const localizedCategories = useMemo(
    () =>
      categories.map((c) => ({
        ...c,
        name: resolveTranslation(c.translations, "name", uiLang, c.name) || c.name,
      })),
    [categories, uiLang],
  );
  const localizedItems = useMemo(
    () =>
      items.map((it) => ({
        ...it,
        name: resolveTranslation(it.translations, "name", uiLang, it.name) || it.name,
        description: resolveTranslation(it.translations, "description", uiLang, it.description),
      })),
    [items, uiLang],
  );
  const [activeCatId, setActiveCatId] = useState<string | null>(
    categories[0]?.id || null,
  );
  const [openItem, setOpenItem] = useState<MenuItemFull | null>(null);
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});

  // Kategori → items map (lokalize üzerinden)
  const itemsByCategory = useMemo(() => {
    const map: Record<string, MenuItemFull[]> = {};
    for (const it of localizedItems) {
      const k = it.categoryId || "_uncategorized";
      (map[k] = map[k] || []).push(it);
    }
    return map;
  }, [localizedItems]);

  // "Kategorisi yok" kalemleri için pseudo-category
  const allCategories: Category[] = useMemo(() => {
    const base = [...localizedCategories];
    if (itemsByCategory["_uncategorized"]) {
      base.push({
        id: "_uncategorized",
        name: "Diğer",
        description: null,
        imageUrl: null,
      });
    }
    return base;
  }, [localizedCategories, itemsByCategory]);

  function scrollToCategory(catId: string) {
    setActiveCatId(catId);
    const el = categoryRefs.current[catId];
    if (el) {
      const offset = 110;  // sticky tab yüksekliği
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
  }

  const itemCount = hydrated ? cartItemCount(cart.items) : 0;
  const subtotal = hydrated ? cartSubtotal(cart.items) : 0;

  return (
    <main className="max-w-2xl mx-auto pb-32">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/70 dark:border-slate-800">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link
            href={`/${locale}/r/${slug}`}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.2} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{brandName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {tableContext ? `Masa ${tableContext.tableLabel}` : "Menü"}
            </div>
          </div>
          {enabledLanguages && enabledLanguages.length > 1 && (
            <LanguagePicker
              slug={slug}
              enabledLanguages={enabledLanguages}
              defaultLanguage={defaultLanguage || "tr"}
              onChange={setUiLang}
            />
          )}
        </div>

        {/* Masa-aware: Garson Çağır + Hesap İste */}
        {tableContext && (
          <TableActionsBar
            slug={slug}
            primaryColor={primaryColor}
            tableContext={tableContext}
          />
        )}

        {/* Samimi karşılama (Butlaroo paterni) — sadece tableContext'te göster */}
        {tableContext && menuGreeting && (
          <div
            className="mx-4 mb-2 px-4 py-2 rounded-xl text-xs italic text-center"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            {menuGreeting}
          </div>
        )}
        {/* Kategori sticky tab bar */}
        {allCategories.length > 1 && (
          <nav className="overflow-x-auto px-2 pb-2 -mx-2 flex gap-1.5 scroll-smooth no-scrollbar">
            {allCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => scrollToCategory(c.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition ${
                  activeCatId === c.id
                    ? "text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
                style={activeCatId === c.id ? { backgroundColor: primaryColor } : undefined}
              >
                {c.name}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Kategori → ürünler */}
      <div className="px-4 sm:px-6 py-5 space-y-8">
        {allCategories.map((cat) => {
          const catItems = itemsByCategory[cat.id] || [];
          if (catItems.length === 0) return null;
          return (
            <section
              key={cat.id}
              ref={(el) => {
                categoryRefs.current[cat.id] = el;
              }}
              id={`cat-${cat.id}`}
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">
                {cat.name}
              </h2>
              <div className="space-y-3">
                {catItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    primaryColor={primaryColor}
                    onClick={() => item.isAvailable && setOpenItem(item)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {items.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
            Bu restoran henüz menü yayınlamadı.
          </div>
        )}
      </div>

      {/* Sticky cart bar */}
      {hydrated && itemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 px-4 pb-4 pt-2 bg-gradient-to-t from-slate-50 dark:from-slate-950 via-slate-50/80 dark:via-slate-950/80 to-transparent">
          <Link
            href={`/${locale}/r/${slug}/sepet`}
            className="max-w-2xl mx-auto flex items-center justify-between gap-4 text-white px-5 py-3.5 rounded-2xl shadow-lg active:scale-[0.98] transition"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <ShoppingBag className="w-5 h-5" strokeWidth={2.2} />
                <span className="absolute -top-2 -right-2 bg-white text-slate-900 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              </div>
              <span className="font-semibold">Sepete Git</span>
            </div>
            <span className="font-bold">{fmtEur(subtotal)}</span>
          </Link>
        </div>
      )}

      {/* Item modal */}
      {openItem && (
        <ItemModal
          item={openItem}
          primaryColor={primaryColor}
          onClose={() => setOpenItem(null)}
          onAdded={(addedItem) => {
            const upsellIds = addedItem.upsellIds || [];
            if (upsellIds.length === 0) return;
            // Sepetteki ürünler zaten ekleniyorsa tekrar önerme
            const cartItemIds = new Set(cart.items.map((i) => i.menuItemId));
            const candidates = localizedItems.filter(
              (it) =>
                upsellIds.includes(it.id) && it.isAvailable && !cartItemIds.has(it.id),
            );
            if (candidates.length > 0) {
              setUpsellFor(addedItem);
            }
          }}
        />
      )}

      {/* Upsell modal */}
      {upsellFor && (
        <UpsellModal
          forItem={upsellFor}
          allItems={localizedItems}
          primaryColor={primaryColor}
          onClose={() => setUpsellFor(null)}
        />
      )}
    </main>
  );
}

function ItemCard({
  item,
  primaryColor,
  onClick,
}: {
  item: MenuItemFull;
  primaryColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!item.isAvailable}
      className={`w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-[0.99] transition text-left overflow-hidden flex gap-3 ${
        !item.isAvailable ? "opacity-60" : ""
      }`}
    >
      {item.imageUrl ? (
        <div
          className="w-28 h-28 flex-shrink-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${item.imageUrl})` }}
        />
      ) : (
        <div className="w-28 h-28 flex-shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <UtensilsCrossed className="w-8 h-8 text-slate-300 dark:text-slate-700" strokeWidth={1.5} />
        </div>
      )}
      <div className="flex-1 min-w-0 py-3 pr-3 flex flex-col justify-between">
        <div>
          <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight flex items-center gap-1.5">
            <span>{item.name}</span>
            {item.isVegan && <Leaf className="w-3.5 h-3.5 text-emerald-600" aria-label="Vegan" />}
            {item.isVegetarian && !item.isVegan && <Leaf className="w-3.5 h-3.5 text-emerald-500" aria-label="Vejetaryen" />}
            {item.isSpicy && <Flame className="w-3.5 h-3.5 text-rose-500" aria-label="Acılı" />}
          </div>
          {item.description && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {item.description}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="font-bold text-sm" style={{ color: primaryColor }}>
            {fmtEur(item.price)}
          </div>
          {item.isAvailable ? (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.6} />
            </div>
          ) : (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Tükendi
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ItemModal({
  item,
  primaryColor,
  onClose,
  onAdded,
}: {
  item: MenuItemFull;
  primaryColor: string;
  onClose: () => void;
  onAdded?: (item: MenuItemFull) => void;
}) {
  const { addItem } = useCart();

  const defaultVariant = item.variants.find((v) => v.isDefault) || item.variants[0] || null;
  const [variantId, setVariantId] = useState<string | null>(defaultVariant?.id || null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const variant = variantId ? item.variants.find((v) => v.id === variantId) || null : null;
  const addons = item.addons.filter((a) => addonIds.includes(a.id));

  const unit =
    item.price +
    (variant?.priceDiff || 0) +
    addons.reduce((s, a) => s + a.price, 0);
  const total = Math.round(unit * quantity * 100) / 100;

  function toggleAddon(id: string) {
    setAddonIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function handleAdd() {
    addItem({
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      basePrice: item.price,
      variant: variant ? { id: variant.id, name: variant.name, priceDiff: variant.priceDiff } : null,
      addons: addons.map((a) => ({ id: a.id, name: a.name, price: a.price })),
      quantity,
      notes: notes.trim() || null,
    });
    onClose();
    onAdded?.(item);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {item.imageUrl && (
          <div
            className="aspect-video bg-cover bg-center sm:rounded-t-2xl relative"
            style={{ backgroundImage: `url(${item.imageUrl})` }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-slate-900 flex items-center justify-center shadow-md transition"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" strokeWidth={2.4} />
            </button>
          </div>
        )}
        {!item.imageUrl && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 flex items-center justify-center shadow-md transition z-10"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" strokeWidth={2.4} />
          </button>
        )}

        <div className="p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{item.name}</h2>
            {item.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                {item.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
              {item.isVegan && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  <Leaf className="w-3 h-3" strokeWidth={2.4} /> Vegan
                </span>
              )}
              {item.isVegetarian && !item.isVegan && (
                <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  <Leaf className="w-3 h-3" strokeWidth={2.4} /> Vejetaryen
                </span>
              )}
              {item.isSpicy && (
                <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full">
                  <Flame className="w-3 h-3" strokeWidth={2.4} /> Acılı
                </span>
              )}
              {item.calories && (
                <span className="text-slate-500 dark:text-slate-400">{item.calories} kcal</span>
              )}
              {item.prepMinutes && (
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3" strokeWidth={2.4} /> {item.prepMinutes} dk
                </span>
              )}
            </div>
            {item.allergens.length > 0 && (
              <div className="mt-3 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" strokeWidth={2.4} />
                <span>İçerir: {item.allergens.join(", ")}</span>
              </div>
            )}
          </div>

          {/* Varyantlar */}
          {item.variants.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Boyut</div>
              <div className="space-y-2">
                {item.variants.map((v) => (
                  <label
                    key={v.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      variantId === v.id
                        ? "border-2 bg-slate-50 dark:bg-slate-800"
                        : "border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                    style={variantId === v.id ? { borderColor: primaryColor } : undefined}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="variant"
                        checked={variantId === v.id}
                        onChange={() => setVariantId(v.id)}
                        className="sr-only"
                      />
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                          variantId === v.id
                            ? "border-2"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                        style={variantId === v.id ? { borderColor: primaryColor } : undefined}
                      >
                        {variantId === v.id && (
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: primaryColor }}
                          />
                        )}
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{v.name}</span>
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {v.priceDiff > 0
                        ? `+${fmtEur(v.priceDiff)}`
                        : v.priceDiff < 0
                          ? `−${fmtEur(Math.abs(v.priceDiff))}`
                          : "Dahil"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Addon'lar */}
          {item.addons.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Ekstralar</div>
              <div className="space-y-2">
                {item.addons.map((a) => (
                  <label
                    key={a.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      addonIds.includes(a.id)
                        ? "border-2 bg-slate-50 dark:bg-slate-800"
                        : "border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                    style={addonIds.includes(a.id) ? { borderColor: primaryColor } : undefined}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={addonIds.includes(a.id)}
                        onChange={() => toggleAddon(a.id)}
                        className="sr-only"
                      />
                      <span
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                          addonIds.includes(a.id) ? "" : "border-slate-300 dark:border-slate-600"
                        }`}
                        style={
                          addonIds.includes(a.id)
                            ? { borderColor: primaryColor, backgroundColor: primaryColor }
                            : undefined
                        }
                      >
                        {addonIds.includes(a.id) && (
                          <svg
                            className="w-3 h-3 text-white"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.name}</span>
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">+{fmtEur(a.price)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Not */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Not (opsiyonel)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="örn. acısız, az tuzlu"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition"
              style={{ ["--tw-ring-color" as string]: primaryColor }}
              maxLength={120}
            />
          </div>

          {/* Adet */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Adet</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition"
                aria-label="Azalt"
              >
                <Minus className="w-4 h-4" strokeWidth={2.4} />
              </button>
              <span className="text-base font-semibold w-6 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition"
                aria-label="Arttır"
              >
                <Plus className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className="w-full flex items-center justify-between text-white px-5 py-3.5 rounded-2xl font-bold shadow-md hover:opacity-95 active:scale-[0.98] transition"
            style={{ backgroundColor: primaryColor }}
          >
            <span>Sepete ekle</span>
            <span>{fmtEur(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function UpsellModal({
  forItem,
  allItems,
  primaryColor,
  onClose,
}: {
  forItem: MenuItemFull;
  allItems: MenuItemFull[];
  primaryColor: string;
  onClose: () => void;
}) {
  const { addItem } = useCart();
  const upsellIds = forItem.upsellIds || [];
  const candidates = allItems.filter((it) => upsellIds.includes(it.id) && it.isAvailable);

  if (candidates.length === 0) {
    // Bu noktaya gelmemeli ama güvenli fallback
    return null;
  }

  function addUpsell(item: MenuItemFull) {
    addItem({
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      basePrice: item.price,
      variant: null,
      addons: [],
      quantity: 1,
      notes: null,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 text-center">
          <div
            className="w-12 h-12 mx-auto rounded-2xl text-white flex items-center justify-center mb-3"
            style={{ backgroundColor: primaryColor }}
          >
            <Sparkles className="w-6 h-6" strokeWidth={2.2} />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Bunu da denemek ister misiniz?
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {forItem.name} ile çok seven müşterilerin tercihi
          </p>
        </div>

        <div className="px-5 pb-3 space-y-2">
          {candidates.slice(0, 3).map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => addUpsell(it)}
              className="w-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl p-3 flex items-center gap-3 transition active:scale-[0.99] text-left"
            >
              {it.imageUrl ? (
                <div
                  className="w-14 h-14 flex-shrink-0 rounded-xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${it.imageUrl})` }}
                />
              ) : (
                <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <UtensilsCrossed className="w-6 h-6 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {it.name}
                </div>
                {it.description && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                    {it.description}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-bold text-sm" style={{ color: primaryColor }}>
                  +€{it.price.toLocaleString("tr-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <Plus
                  className="w-5 h-5 mt-1 ml-auto text-white rounded-full p-0.5"
                  style={{ backgroundColor: primaryColor }}
                  strokeWidth={2.6}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 py-2 transition"
          >
            Hayır, teşekkürler
          </button>
        </div>
      </div>
    </div>
  );
}
