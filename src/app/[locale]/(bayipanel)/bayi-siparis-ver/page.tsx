"use client";

/**
 * /tr/bayi-siparis-ver — Bayi yeni sipariş oluşturma (sepet flow).
 *
 * 1. Admin ürün kataloğu fetch (/api/urunler/list)
 * 2. Bayi ürün arar, sepete ekler (miktar belirler)
 * 3. "Sipariş Ver" → POST /api/bayi-dealer-orders/create → pending
 * 4. Admin /tr/bayilik-siparisleri'nde onaylar/reddeder
 *
 * Sadece bayi'nin kendi kullanımı için. Admin'in eski "bayi adına sipariş
 * kaydet" akışı (/tr/bayi-siparis) farklı endpoint, ayrı korunur.
 */

import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Plus, Minus, Trash2, Loader2, CheckCircle2, Search } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface Product {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  unitPrice: number;
  stockQuantity: number;
  stockStatus: "out" | "critical" | "ok";
}

interface CartLine {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}

function fmtTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(n);
}

export default function BayiSiparisVerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ orderId: string; total: number } | null>(null);
  const [creditBlock, setCreditBlock] = useState<{
    currentBalance: number;
    attemptedTotal: number;
    creditLimit: number;
    exceededBy: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/urunler/list?pageSize=100", { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Ürünler alınamadı.");
        setProducts(d.rows || []);
      })
      .catch((e) => setError(e.message || "Bağlantı hatası."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLocaleLowerCase("tr");
    return products.filter((p) =>
      p.name.toLocaleLowerCase("tr").includes(q) ||
      p.code.toLocaleLowerCase("tr").includes(q) ||
      (p.brand || "").toLocaleLowerCase("tr").includes(q),
    );
  }, [products, search]);

  const cartArr = useMemo(() => Array.from(cart.values()), [cart]);
  const total = cartArr.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  function addOne(p: Product) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(p.id);
      next.set(p.id, {
        productId: p.id,
        productName: p.name,
        unitPrice: p.unitPrice,
        quantity: (existing?.quantity || 0) + 1,
      });
      return next;
    });
  }
  function removeOne(productId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) next.delete(productId);
      else next.set(productId, { ...existing, quantity: existing.quantity - 1 });
      return next;
    });
  }
  function removeLine(productId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }

  async function submit() {
    if (cartArr.length === 0) {
      setError("Sepete en az bir ürün ekleyin.");
      return;
    }
    setSubmitting(true);
    setError("");
    setCreditBlock(null);
    try {
      const r = await fetch("/api/bayi-dealer-orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          items: cartArr.map((l) => ({
            product_id: l.productId,
            product_name: l.productName,
            unit_price: l.unitPrice,
            quantity: l.quantity,
          })),
          notes: notes.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 409 && d.error === "credit_limit_exceeded") {
          setCreditBlock({
            currentBalance: Number(d.current_balance) || 0,
            attemptedTotal: Number(d.attempted_total) || 0,
            creditLimit: Number(d.credit_limit) || 0,
            exceededBy: Number(d.exceeded_by) || 0,
          });
          setError(d.message || "Kredi limiti aşıldı.");
        } else {
          setError(d.error || "Sipariş oluşturulamadı.");
        }
        return;
      }
      setSubmitted({ orderId: d.order_id, total: d.total });
      setCart(new Map());
      setNotes("");
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <HeroBanner Icon={CheckCircle2} title="Sipariş Alındı" subtitle="Onay için bekliyor. Durumu Siparişlerim'den takip edebilirsiniz." />
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-3 border border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Sipariş No</p>
            <p className="font-mono text-base text-slate-900 dark:text-white">#{submitted.orderId.slice(0, 8)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Toplam</p>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{fmtTRY(submitted.total)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <a href="/tr/bayi-siparislerim" className="text-center py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
              Siparişlerim
            </a>
            <button type="button" onClick={() => setSubmitted(null)} className="py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold">
              Yeni Sipariş
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner Icon={ShoppingCart} title="Yeni Sipariş" subtitle="Kataloğdan ürün seç, sepete ekle, sipariş ver." />

      {creditBlock && (
        <div
          data-testid="credit-limit-warning"
          className="bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-700 rounded-2xl p-4 text-sm text-rose-800 dark:text-rose-200 space-y-2"
        >
          <div className="flex items-center gap-2 font-semibold">⛔ Kredi limitiniz aşıldı</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-rose-600 dark:text-rose-300">Mevcut bakiye:</span>
            <span className="font-semibold tabular-nums">{fmtTRY(creditBlock.currentBalance)}</span>
            <span className="text-rose-600 dark:text-rose-300">Sipariş tutarı:</span>
            <span className="font-semibold tabular-nums">{fmtTRY(creditBlock.attemptedTotal)}</span>
            <span className="text-rose-600 dark:text-rose-300">Kredi limiti:</span>
            <span className="font-semibold tabular-nums">{fmtTRY(creditBlock.creditLimit)}</span>
            <span className="text-rose-700 dark:text-rose-200 font-semibold">Aşım:</span>
            <span className="font-bold tabular-nums">{fmtTRY(creditBlock.exceededBy)}</span>
          </div>
          <p className="text-xs">
            Sipariş tutarını <strong>{fmtTRY(creditBlock.exceededBy)}</strong> düşürün veya yöneticinizden limit artışı isteyin.
          </p>
        </div>
      )}

      {error && !creditBlock && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-2xl p-3 text-sm text-rose-700 dark:text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {cartArr.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sepetim ({cartArr.length} ürün)</h2>
          {cartArr.map((line) => (
            <div key={line.productId} className="flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 dark:text-white truncate">{line.productName}</div>
                <div className="text-xs text-slate-500">{fmtTRY(line.unitPrice)} × {line.quantity} = {fmtTRY(line.unitPrice * line.quantity)}</div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => removeOne(line.productId)} className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95">
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-sm font-medium w-6 text-center">{line.quantity}</span>
                <button type="button" onClick={() => {
                  const p = products.find((x) => x.id === line.productId);
                  if (p) addOne(p);
                }} className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95">
                  <Plus className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => removeLine(line.productId)} aria-label="Sil" className="w-7 h-7 rounded text-rose-500 flex items-center justify-center active:scale-95">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Toplam</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">{fmtTRY(total)}</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Sipariş notu (opsiyonel) — kargolama tercihi, özel istek vs."
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800"
          />
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Gönderiliyor…" : "Sipariş Ver"}
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ürün ara…"
          className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
        />
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-slate-500 py-8">Ürün bulunamadı.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const inCart = cart.get(p.id);
            return (
              <div key={p.id} className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white text-sm truncate">{p.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {p.code}{p.brand ? ` · ${p.brand}` : ""} · Stok: {p.stockQuantity}
                  </div>
                  <div className="text-sm font-bold text-emerald-600 mt-0.5">{fmtTRY(p.unitPrice)}</div>
                </div>
                {inCart ? (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => removeOne(p.id)} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold w-7 text-center">{inCart.quantity}</span>
                    <button type="button" onClick={() => addOne(p)} className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => addOne(p)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold active:scale-95">
                    + Sepete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
