"use client";

/**
 * Bayi Ürün Detay (Faz 2 Sprint B).
 *
 * Sol: foto galeri (image_url + images jsonb).
 * Sağ: bilgi + stok + tahmini teslim + kademe fiyat tablosu + adet seçici +
 *      sepete ekle butonu + favori.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Package,
  ShoppingCart,
  Truck,
  Minus,
  Plus,
  Check,
} from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/admin/v3-shell";
import { addToCart, getCartCount } from "@/lib/buyer-cart";

interface PriceTier {
  minQuantity: number;
  discountPercent: number;
  effectiveUnitPrice: number;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  basePrice: number;
  unit: string;
  imageUrl: string | null;
  images: string[];
  stockQuantity: number;
  lowStockThreshold: number | null;
  categoryName: string | null;
  brand: string | null;
  barcode: string | null;
  minOrder: number;
  isFavorite: boolean;
  estimatedDelivery: string;
}

interface Pricing {
  basePrice: number;
  listUnitPrice: number;
  source: "price_list" | "base_price";
  priceListId: string | null;
  priceListName: string | null;
  tiers: PriceTier[];
  currency: string;
}

const formatPara = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);

export default function BayiUrunDetayPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";
  const id = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [favBusy, setFavBusy] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [, setCartCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bayi/katalog/${id}`, {
        credentials: "same-origin",
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setProduct(d.product);
      setPricing(d.pricing);
      setQuantity(Math.max(1, d.product.minOrder || 1));
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  useEffect(() => {
    setCartCount(getCartCount());
  }, []);

  // Geçerli birim fiyat (kademe iskonto uygulanmış)
  const effectiveUnit = useMemo(() => {
    if (!pricing) return 0;
    const tier = [...pricing.tiers]
      .filter((t) => t.minQuantity <= quantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];
    return tier ? tier.effectiveUnitPrice : pricing.listUnitPrice;
  }, [pricing, quantity]);

  const lineTotal = useMemo(() => effectiveUnit * quantity, [effectiveUnit, quantity]);

  async function toggleFavorite() {
    if (!product) return;
    setFavBusy(true);
    setProduct({ ...product, isFavorite: !product.isFavorite });
    try {
      const res = await fetch("/api/bayi/favori", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setProduct({ ...product, isFavorite: product.isFavorite });
    } finally {
      setFavBusy(false);
    }
  }

  function handleAddToCart() {
    if (!product || !pricing) return;
    addToCart({
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      unit: product.unit,
      basePrice: pricing.basePrice,
      listUnitPrice: effectiveUnit,
      imageUrl: product.imageUrl,
      quantity,
    });
    setCartCount(getCartCount());
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error && !product) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  if (!product || !pricing) return null;

  const gallery: string[] = [
    ...(product.imageUrl ? [product.imageUrl] : []),
    ...product.images,
  ];

  const stockTone: StatusTone =
    product.stockQuantity <= 0
      ? "danger"
      : product.lowStockThreshold && product.stockQuantity < product.lowStockThreshold
        ? "warning"
        : "success";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/bayi/katalog`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-sm text-slate-500">
          {product.categoryName ? `Katalog · ${product.categoryName}` : "Katalog"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Foto galeri */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-72 items-center justify-center rounded-lg bg-slate-50">
            {gallery.length > 0 ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={gallery[0]}
                alt={product.name}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <Package className="h-20 w-20 text-slate-300" />
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {gallery.slice(0, 6).map((src, i) => (
                <div
                  key={i}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Bilgi + fiyat + adet + sepet */}
        <section className="space-y-4">
          <div>
            <p className="text-xs text-slate-500">
              {product.code}
              {product.brand && ` · ${product.brand}`}
              {product.barcode && ` · ${product.barcode}`}
            </p>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">
                {product.name}
              </h1>
              <button
                onClick={toggleFavorite}
                disabled={favBusy}
                className="rounded-md p-2 hover:bg-slate-100 disabled:opacity-60"
                aria-label="Favori"
              >
                <Heart
                  className={`h-5 w-5 ${
                    product.isFavorite
                      ? "fill-rose-500 text-rose-500"
                      : "text-slate-400"
                  }`}
                />
              </button>
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {product.description}
            </p>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-3xl font-semibold tabular-nums text-slate-900">
                {formatPara(effectiveUnit)}
              </span>
              <span className="text-sm text-slate-500">/ {product.unit}</span>
            </div>
            {pricing.source === "price_list" && pricing.basePrice > pricing.listUnitPrice && (
              <p className="mt-1 text-xs text-slate-500">
                <span className="line-through tabular-nums">
                  {formatPara(pricing.basePrice)}
                </span>{" "}
                <span className="ml-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  {pricing.priceListName || "Sana özel fiyat"}
                </span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge tone={stockTone}>
                {product.stockQuantity > 0
                  ? `${product.stockQuantity} ${product.unit} stokta`
                  : "Stokta yok"}
              </StatusBadge>
              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                <Truck className="h-3.5 w-3.5" /> {product.estimatedDelivery}
              </span>
            </div>
          </div>

          {pricing.tiers.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-700">
                Toplu Alımda Kademe İndirim
              </p>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="py-1">Min. miktar</th>
                    <th className="py-1 text-right">İskonto</th>
                    <th className="py-1 text-right">Birim fiyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1.5 tabular-nums">1 {product.unit}</td>
                    <td className="py-1.5 text-right">—</td>
                    <td className="py-1.5 text-right font-medium tabular-nums">
                      {formatPara(pricing.listUnitPrice)}
                    </td>
                  </tr>
                  {pricing.tiers.map((t, i) => (
                    <tr
                      key={i}
                      className={
                        quantity >= t.minQuantity ? "bg-emerald-50/60" : ""
                      }
                    >
                      <td className="py-1.5 tabular-nums">
                        {t.minQuantity}+ {product.unit}
                      </td>
                      <td className="py-1.5 text-right text-emerald-700">
                        %{t.discountPercent}
                      </td>
                      <td className="py-1.5 text-right font-medium tabular-nums">
                        {formatPara(t.effectiveUnitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-700">Adet</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-slate-200">
                <button
                  onClick={() =>
                    setQuantity((q) => Math.max(product.minOrder, q - 1))
                  }
                  className="px-3 text-slate-700 hover:bg-slate-50"
                  aria-label="Azalt"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min={product.minOrder}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      Math.max(
                        product.minOrder,
                        parseInt(e.target.value, 10) || product.minOrder,
                      ),
                    )
                  }
                  className="w-16 border-x border-slate-200 px-2 text-center text-sm tabular-nums focus:outline-none"
                />
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="px-3 text-slate-700 hover:bg-slate-50"
                  aria-label="Artır"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="text-xs text-slate-500">
                Min: {product.minOrder} {product.unit}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              Toplam{" "}
              <span className="text-base font-semibold tabular-nums text-slate-900">
                {formatPara(lineTotal)}
              </span>
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={handleAddToCart}
                disabled={product.stockQuantity <= 0}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {addedFeedback ? (
                  <>
                    <Check className="h-4 w-4" />
                    Sepete eklendi
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Sepete Ekle
                  </>
                )}
              </button>
              <button
                onClick={() => router.push(`/${locale}/bayi/sepet`)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sepete Git
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
