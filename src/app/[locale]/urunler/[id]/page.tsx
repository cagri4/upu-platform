/**
 * /urunler/[id] — ürün detay sayfası (magic-link auth).
 *
 * Layout (mobile-first, single column):
 *   - Üst görsel (image_url veya placeholder)
 *   - İsim + marka + kod + kategori
 *   - Fiyat / stok / KDV / minimum sipariş kart
 *   - Açıklama (varsa)
 *   - Son siparişler tablosu (bu ürünü içeren)
 *
 * Tour koridor: useEffect mount'ta tour_urun_detay_done advance —
 * Step 5'ten Step 6'ya geçirir.
 */
"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  unit: string;
  basePrice: number;
  unitPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  stockStatus: "out" | "critical" | "ok";
  minOrder: number;
  imageUrl: string | null;
  barcode: string | null;
  weight: number;
  vatRate: number | null;
}

interface RecentOrder {
  orderId: string;
  orderNumber: string;
  dealerName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
}

interface DetailResp {
  product: Product;
  recentOrders: RecentOrder[];
}

function formatTry(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function UrunDetayPage() {
  const params = useParams();
  const sp = useSearchParams();
  const id = params.id as string;
  const token = sp.get("t") || sp.get("token") || "";

  const [data, setData] = useState<DetailResp | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setError("Geçersiz id."); setLoading(false); return; }
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/urunler/${id}${qs}`, { credentials: "same-origin" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Detay alınamadı");
        setData(d);
        // Tour koridor — ürün detay açıldıkça Adım 4 (urun_detay) tamam.
        fetch(`/api/tour/advance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, event: "tour_urun_detay_done" }),
        }).catch(() => { /* sessiz */ });
      })
      .catch(e => setError(e.message || "Bağlantı hatası"))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">Yükleniyor...</div>;
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/50 rounded-xl p-6 text-center">
          <h1 className="text-lg font-semibold text-rose-700 mb-2">Hata</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{error || "Ürün bulunamadı."}</p>
        </div>
      </div>
    );
  }

  const { product, recentOrders } = data;
  const backHref = `/tr/urunler?t=${encodeURIComponent(token)}`;

  const stockBadgeCls = {
    out: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 font-semibold",
    critical: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 font-semibold",
    ok: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700",
  }[product.stockStatus];
  const stockText = {
    out: "Tükendi",
    critical: `Kritik — ${product.stockQuantity} ${product.unit} kaldı`,
    ok: `${product.stockQuantity} ${product.unit} mevcut`,
  }[product.stockStatus];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 py-3 text-sm">
          <Link href={backHref} className="text-indigo-600 hover:underline">📦 Ürün Kataloğu</Link>
          <span className="text-slate-400 mx-2">›</span>
          <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{product.name}</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Üst kart — görsel + temel bilgi */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl overflow-hidden">
          <div className="aspect-square sm:aspect-[16/9] bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-6xl text-slate-300">📦</span>
            )}
          </div>
          <div className="p-4">
            {product.brand && <div className="text-xs text-slate-400 uppercase tracking-wide">{product.brand}</div>}
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{product.name}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {product.category && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">{product.category}</span>
              )}
              {product.code && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-mono">{product.code}</span>
              )}
              <span className={`px-2 py-0.5 rounded-full ${stockBadgeCls}`}>{stockText}</span>
            </div>
          </div>
        </section>

        {/* Fiyat / Stok / KDV / Min Sipariş kartları */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-3">
            <div className="text-[10px] text-slate-500 uppercase">Fiyat</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{formatTry(product.unitPrice)}</div>
            <div className="text-[10px] text-slate-400">/ {product.unit}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-3">
            <div className="text-[10px] text-slate-500 uppercase">Stok</div>
            <div className={`text-lg font-bold mt-1 ${product.stockStatus === "out" ? "text-rose-600" : product.stockStatus === "critical" ? "text-amber-600" : "text-emerald-600"}`}>
              {product.stockQuantity}
            </div>
            <div className="text-[10px] text-slate-400">{product.unit}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-3">
            <div className="text-[10px] text-slate-500 uppercase">KDV</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {product.vatRate !== null ? `%${product.vatRate}` : "—"}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-3">
            <div className="text-[10px] text-slate-500 uppercase">Min sipariş</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{product.minOrder}</div>
            <div className="text-[10px] text-slate-400">{product.unit}</div>
          </div>
        </section>

        {/* Açıklama */}
        {product.description && (
          <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">📝 Açıklama</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{product.description}</p>
          </section>
        )}

        {/* Ek bilgi — barkod, ağırlık */}
        {(product.barcode || product.weight > 0) && (
          <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-6 gap-y-1">
            {product.barcode && <div>🏷 Barkod: <span className="font-mono">{product.barcode}</span></div>}
            {product.weight > 0 && <div>⚖️ Ağırlık: {product.weight} kg</div>}
          </section>
        )}

        {/* Son siparişler */}
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">🛒 Bu Üründe Son Siparişler</h2>
          {recentOrders.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Bu ürünü içeren sipariş yok.</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(o => (
                <div key={o.orderId} className="flex items-center justify-between border border-slate-100 rounded-lg p-2.5 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{o.dealerName}</div>
                    <div className="text-xs text-slate-500 flex gap-3">
                      <span>{o.quantity} {product.unit}</span>
                      <span>×</span>
                      <span>{formatTry(o.unitPrice)}</span>
                      {o.createdAt && <span className="text-slate-400">· {formatDateTime(o.createdAt)}</span>}
                    </div>
                  </div>
                  <div className="font-semibold text-sm">{formatTry(o.totalPrice)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
