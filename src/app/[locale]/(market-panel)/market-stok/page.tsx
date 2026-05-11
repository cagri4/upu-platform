"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-slate-700">{error}</p>
      </div>
    );
  }

  if (!products) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow">
        <div className="text-3xl">⏳</div>
        <p className="text-slate-500 text-sm mt-2">Stok yükleniyor...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold">Stok</h1>
          <p className="text-amber-100 text-sm mt-2">Henüz ürün eklenmemiş.</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 text-sm text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900 mb-2">📦 İlk ürününüzü ekleyin</p>
          <p>
            WhatsApp&apos;tan{" "}
            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">stokekle</span>
            {" "}komutu ile ürün ekleyebilirsiniz. Ürün adı, miktar ve birim adımlarını sırayla girin.
          </p>
        </div>
      </div>
    );
  }

  const lowCount = products.filter(isLowStock).length;
  const expiringCount = products.filter(isExpiringSoon).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Stok</h1>
        <p className="text-amber-100 text-sm mt-2">
          {products.length} ürün{lowCount > 0 ? ` · ${lowCount} kritik` : ""}{expiringCount > 0 ? ` · ${expiringCount} SKT yaklaşan` : ""}
        </p>
      </div>

      {/* Liste */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {products.map((p) => {
            const low = isLowStock(p);
            const expiring = isExpiringSoon(p);
            return (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-2">
                    {p.category && <span>{p.category}</span>}
                    {p.expiry_date && (
                      <span className={expiring ? "text-amber-700 font-semibold" : ""}>
                        SKT: {new Date(p.expiry_date).toLocaleDateString("tr-TR")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${low ? "text-rose-600" : "text-slate-900"}`}>
                    {p.quantity} {p.unit || "adet"}
                  </div>
                  {p.price != null && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {Number(p.price).toLocaleString("tr-TR")} €
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hint */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 text-sm text-slate-600 shadow-sm">
        <p>
          Yeni ürün eklemek için WhatsApp&apos;tan{" "}
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">stokekle</span>
          {" "}komutunu kullanın. Düşük stoklar kırmızı, son kullanma tarihi yaklaşanlar sarı renkle işaretlenir.
        </p>
      </div>
    </div>
  );
}
