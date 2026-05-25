"use client";

/**
 * Market Stok — banking primitive port.
 *
 * - HeroBanner üst (Package icon, ürün/uyarı özet subtitle)
 * - LoadingState card variant
 * - Empty state: HeroBanner + InfoChip "stokekle" WA hint
 * - Liste: banking-style white card + divide-y rows, kritik stok rose
 *   highlight, SKT yaklaşan amber. Listenin kendisi ListCard değil
 *   (chevron + tek-tıklama navigasyonu için değil, görüntüleme).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Package, MessageCircle, AlertTriangle } from "lucide-react";
import { HeroBanner, InfoChip, LoadingState } from "@/components/banking";

interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  price: number | null;
  category: string | null;
  expiry_date: string | null;
  min_stock: number | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function MarketStokPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`/api/market/stok?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) { setError(d.error); return; }
        setProducts(d.products || []);
      })
      .catch(() => setError("Bağlantı hatası."));
  }, [token]);

  const now = Date.now();
  const sevenDaysLater = now + SEVEN_DAYS_MS;

  function isLowStock(p: Product): boolean {
    return p.quantity <= (p.min_stock ?? 10);
  }

  function isExpiringSoon(p: Product): boolean {
    if (!p.expiry_date) return false;
    const t = new Date(p.expiry_date).getTime();
    return t <= sevenDaysLater && t >= now;
  }

  const waUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WA_NUMBER || "31610000000"}?text=stokekle`;

  if (error) {
    return (
      <div className="space-y-5">
        <HeroBanner Icon={Package} title="Stok" subtitle="Listeleme yüklenemedi." />
        <InfoChip Icon={AlertTriangle} text={error} />
      </div>
    );
  }

  if (!products) {
    return (
      <div className="space-y-5">
        <HeroBanner Icon={Package} title="Stok" subtitle="Yükleniyor..." />
        <LoadingState variant="card" label="Stok listesi yükleniyor" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-5">
        <HeroBanner
          Icon={Package}
          title="Stok"
          subtitle="Henüz ürün eklenmemiş. WhatsApp'tan ilk ürününüzü ekleyin."
        />
        <InfoChip
          Icon={MessageCircle}
          text="WhatsApp'ta 'stokekle' yazarak ekle"
          href={waUrl}
        />
      </div>
    );
  }

  const lowCount = products.filter(isLowStock).length;
  const expiringCount = products.filter(isExpiringSoon).length;
  const subtitle = `${products.length} ürün${lowCount > 0 ? ` · ${lowCount} kritik` : ""}${expiringCount > 0 ? ` · ${expiringCount} SKT yaklaşan` : ""}`;

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner Icon={Package} title="Stok" subtitle={subtitle} />

      {/* Liste — banking white card + divide rows */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {products.map((p) => {
            const low = isLowStock(p);
            const expiring = isExpiringSoon(p);
            return (
              <div key={p.id} className="px-4 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {p.category && <span>{p.category}</span>}
                    {p.expiry_date && (
                      <span className={expiring ? "text-amber-600 dark:text-amber-400 font-semibold" : ""}>
                        SKT: {new Date(p.expiry_date).toLocaleDateString("tr-TR")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-bold ${low ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"}`}>
                    {p.quantity} {p.unit || "adet"}
                  </div>
                  {p.price != null && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {Number(p.price).toLocaleString("tr-TR")} €
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WA stokekle ipucu */}
      <InfoChip
        Icon={MessageCircle}
        text="Yeni ürün için WhatsApp'tan 'stokekle' yazın"
        href={waUrl}
      />
    </div>
  );
}
