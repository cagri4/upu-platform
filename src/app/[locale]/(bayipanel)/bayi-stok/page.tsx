"use client";

/**
 * Bayi Stok Yönetimi — Sprint 2 (WA komut regresyon kapatma).
 *
 * Eski WA `stok` / `kritikstok` / `tedarikciler` komutlarının panel karşılığı.
 * Owner/depocu artık stoğu paneldenden takip eder, manuel hareket kaydeder.
 *
 * 4 ana bölüm:
 *   1. Özet kartlar (Toplam / Kritik / Tükendi / OK)
 *   2. Ürün listesi tablo — kritik altı kırmızı vurgu + inline "Hareket"/"Sipariş" buton
 *   3. Manuel hareket modal (in/out/adjust)
 *   4. Tedarikçi sipariş modal (yolda — stock'a düşmez)
 *   5. Son hareketler timeline (her ürün için aggregated)
 *
 * Admin/depocu rol guard layout level (BAYI_ROLE_REQUIREMENTS).
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Package, Box, History } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

interface Product {
  id: string;
  name: string;
  code: string | null;
  unit: string;
  stockQuantity: number;
  lowStockThreshold: number;
  category: string | null;
  brand: string | null;
  status: "out" | "critical" | "ok";
}

interface Movement {
  id: string;
  productId: string;
  type: "in" | "out" | "adjust" | "supplier_order";
  quantity: number;
  reason: string | null;
  unitCost: number | null;
  createdAt: string;
}

interface PendingOrder {
  id: string;
  productId: string;
  quantity: number;
  reason: string | null;
  supplierName: string | null;
  expectedArrival: string | null;
  unitCost: number | null;
  createdAt: string;
}

interface StokResp {
  success: true;
  summary: { total: number; critical: number; out: number; ok: number };
  products: Product[];
  recentMovements: Movement[];
  pendingSupplierOrders: PendingOrder[];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TYPE_META: Record<string, { label: string; icon: string; cls: string }> = {
  in:             { label: "Giriş",         icon: "↑", cls: "text-emerald-700 bg-emerald-50" },
  out:            { label: "Çıkış",         icon: "↓", cls: "text-rose-700 bg-rose-50" },
  adjust:         { label: "Düzeltme",      icon: "≈", cls: "text-amber-700 bg-amber-50" },
  supplier_order: { label: "Sipariş",       icon: "📦", cls: "text-indigo-700 bg-indigo-50" },
};

export default function BayiStokPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";
  const [data, setData] = useState<StokResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "critical" | "out" | "ok">("all");
  const [search, setSearch] = useState("");
  const [moveProduct, setMoveProduct] = useState<Product | null>(null);
  const [orderProduct, setOrderProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = token ? `?t=${encodeURIComponent(token)}` : "";
      const r = await fetch(`/api/bayi-stok/list${qs}`, { credentials: "same-origin" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Stok alınamadı."); return; }
      setData(d);
    } catch {
      setError("Bağlantı hatası.");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-10 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl p-6 text-center">
          <p className="text-rose-700 font-medium">{error || "Veri alınamadı."}</p>
        </div>
      </div>
    );
  }

  const filtered = data.products
    .filter(p => filter === "all" ? true : p.status === filter)
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()) || (p.code || "").toLowerCase().includes(search.toLowerCase()));

  const movByProduct = new Map<string, Movement[]>();
  for (const m of data.recentMovements) {
    if (!movByProduct.has(m.productId)) movByProduct.set(m.productId, []);
    movByProduct.get(m.productId)!.push(m);
  }
  const pendingByProduct = new Map<string, PendingOrder[]>();
  for (const o of data.pendingSupplierOrders) {
    if (!pendingByProduct.has(o.productId)) pendingByProduct.set(o.productId, []);
    pendingByProduct.get(o.productId)!.push(o);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">📦 Stok Yönetimi</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Mevcut stok, kritik uyarılar, manuel hareket ve tedarikçi siparişleri.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <SummaryCard label="Toplam Ürün" value={data.summary.total} color="slate" active={filter === "all"} onClick={() => setFilter("all")} />
        <SummaryCard label="🟢 OK" value={data.summary.ok} color="emerald" active={filter === "ok"} onClick={() => setFilter("ok")} />
        <SummaryCard label="🟡 Kritik" value={data.summary.critical} color="amber" active={filter === "critical"} onClick={() => setFilter("critical")} />
        <SummaryCard label="🔴 Tükendi" value={data.summary.out} color="rose" active={filter === "out"} onClick={() => setFilter("out")} />
      </div>

      <div className="mb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Ürün adı veya kodu ara…"
          className="w-full border border-slate-200 dark:border-slate-800/50 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl">
          <EmptyState
            icon={filter === "all" ? Package : Box}
            title={
              filter === "critical" ? "Kritik seviyede ürün yok 🎉"
              : filter === "out" ? "Tükenmiş ürün yok 🎉"
              : filter === "ok" ? "OK seviyesinde ürün yok"
              : data.products.length === 0 ? "Henüz ürün yok"
              : "Aramayla eşleşen ürün yok"
            }
            description={
              data.products.length === 0
                ? "Önce 'Ürünlerim'e ürün ekle (Excel toplu yükleme veya tek tek). Sonra stok burada takip edilebilir."
                : filter === "critical" || filter === "out"
                ? "Stok eşiği altına düşen ürünler burada listelenir. Kritik eşik 'Ürünlerim' sayfasından her ürün için ayarlanır."
                : "Filtre ya da arama kriterini değiştir."
            }
            cta={data.products.length === 0 ? { label: "+ Ürün Ekle", href: "/tr/bayi-urun-ekle" } : undefined}
            accent={filter === "critical" || filter === "out" ? "emerald" : "indigo"}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Ürün</th>
                <th className="text-right px-3 py-2">Stok</th>
                <th className="text-right px-3 py-2">Kritik</th>
                <th className="text-left px-3 py-2 hidden md:table-cell">Son Hareket</th>
                <th className="text-right px-3 py-2">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const movs = movByProduct.get(p.id) || [];
                const lastMov = movs[0];
                const pending = pendingByProduct.get(p.id) || [];
                return (
                  <tr key={p.id} className={`border-t border-slate-100 dark:border-slate-800/50 ${p.status === "out" ? "bg-rose-50/40" : p.status === "critical" ? "bg-amber-50/40" : ""}`}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{p.name}</div>
                      <div className="text-[11px] text-slate-400 flex gap-2 mt-0.5 flex-wrap">
                        {p.code && <span className="font-mono">{p.code}</span>}
                        {p.category && <span>· {p.category}</span>}
                        {pending.length > 0 && (
                          <span className="text-indigo-600 font-medium">
                            🚚 {pending.reduce((s, o) => s + o.quantity, 0)} {p.unit} yolda
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${p.status === "out" ? "text-rose-700" : p.status === "critical" ? "text-amber-700" : "text-slate-800 dark:text-slate-200"}`}>
                      {p.stockQuantity} <span className="text-[11px] text-slate-400">{p.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500">
                      {p.lowStockThreshold > 0 ? p.lowStockThreshold : "—"}
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      {lastMov ? (
                        <div className="text-xs">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_META[lastMov.type].cls}`}>
                            {TYPE_META[lastMov.type].icon} {lastMov.quantity}
                          </span>
                          <span className="text-slate-400 ml-1">{fmtDate(lastMov.createdAt)}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => setMoveProduct(p)}
                        className="text-xs px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium mr-1"
                      >
                        Hareket
                      </button>
                      <button
                        onClick={() => setOrderProduct(p)}
                        className="text-xs px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium"
                      >
                        Sipariş
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Son Hareketler timeline */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">📜 Son Hareketler ({data.recentMovements.length})</h2>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl divide-y divide-slate-100 dark:divide-slate-800/50">
          {data.recentMovements.length === 0 ? (
            <EmptyState
              icon={History}
              title="Henüz hareket yok"
              description="Stok giriş/çıkış/düzeltme kayıtları burada görünecek. Ürün listesinde 'Hareket' butonundan manuel kayıt geçebilirsin."
              accent="slate"
            />
          ) : data.recentMovements.slice(0, 20).map(m => {
            const product = data.products.find(p => p.id === m.productId);
            const meta = TYPE_META[m.type];
            return (
              <div key={m.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${meta.cls}`}>
                  {meta.icon} {meta.label}
                </span>
                <span className="flex-1 truncate">
                  <span className="font-medium">{product?.name || "(silinmiş ürün)"}</span>
                  <span className="text-slate-500"> — {m.quantity} {product?.unit || ""}</span>
                  {m.reason && <span className="text-slate-400 ml-1">· {m.reason}</span>}
                </span>
                <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDate(m.createdAt)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {moveProduct && (
        <MoveModal
          product={moveProduct}
          token={token}
          onClose={() => setMoveProduct(null)}
          onSaved={() => { setMoveProduct(null); void load(); }}
        />
      )}
      {orderProduct && (
        <SupplierOrderModal
          product={orderProduct}
          token={token}
          onClose={() => setOrderProduct(null)}
          onSaved={() => { setOrderProduct(null); void load(); }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, active, onClick }: {
  label: string; value: number; color: "slate" | "emerald" | "amber" | "rose";
  active: boolean; onClick: () => void;
}) {
  const colors = {
    slate:   "border-slate-300 text-slate-700",
    emerald: "border-emerald-300 text-emerald-700",
    amber:   "border-amber-300 text-amber-700",
    rose:    "border-rose-300 text-rose-700",
  };
  return (
    <button
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-xl p-3 text-left border-2 transition ${active ? colors[color] : "border-transparent hover:border-slate-200"}`}
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-2xl font-bold mt-0.5 text-slate-900 dark:text-slate-100">{value}</div>
    </button>
  );
}

function MoveModal({ product, token, onClose, onSaved }: { product: Product; token: string; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const n = Number(qty);
    if (!Number.isFinite(n) || n === 0) { setError("Geçerli miktar girin."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/bayi-stok/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token: token || undefined,
          product_id: product.id,
          type,
          quantity: n,
          reason: reason.trim() || undefined,
          unit_cost: cost.trim() ? Number(cost) : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kayıt başarısız."); return; }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-1">Stok Hareketi</h2>
        <p className="text-xs text-slate-500 mb-4 truncate">{product.name} · {product.stockQuantity} {product.unit} mevcut</p>

        <label className="block mb-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tür</span>
          <div className="grid grid-cols-3 gap-1 mt-1">
            {(["in", "out", "adjust"] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`text-xs py-2 rounded-lg border font-medium ${type === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200 text-slate-700"}`}
              >
                {TYPE_META[t].icon} {TYPE_META[t].label}
              </button>
            ))}
          </div>
        </label>

        <label className="block mb-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Miktar ({product.unit})
            {type === "adjust" && <span className="text-slate-400"> · negatif olabilir</span>}
          </span>
          <input
            type="number" step="0.001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            placeholder={type === "adjust" ? "Örn: -3 (eksilt) veya +5 (artır)" : "Örn: 10"}
          />
        </label>

        <label className="block mb-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Açıklama (opsiyonel)</span>
          <input
            type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            placeholder="Örn: Yeni mal alımı, fire, sayım"
          />
        </label>

        {type === "in" && (
          <label className="block mb-3">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Birim maliyet (opsiyonel)</span>
            <input
              type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
              placeholder="Birim TL"
            />
          </label>
        )}

        {error && <div className="text-xs text-rose-600 mb-2">⚠️ {error}</div>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Vazgeç</button>
          <button onClick={() => void save()} disabled={saving} className="flex-1 text-sm py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierOrderModal({ product, token, onClose, onSaved }: { product: Product; token: string; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState("");
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) { setError("Geçerli miktar girin."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/bayi-stok/supplier-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token: token || undefined,
          product_id: product.id,
          quantity: n,
          supplier_name: supplier.trim() || undefined,
          expected_arrival: date || undefined,
          unit_cost: cost.trim() ? Number(cost) : undefined,
          reason: reason.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Kayıt başarısız."); return; }
      onSaved();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold mb-1">📦 Tedarikçi Siparişi</h2>
        <p className="text-xs text-slate-500 mb-3 truncate">{product.name} · Yolda olarak işaretlenir, mal gelince &quot;Hareket → Giriş&quot; ile gerçek stok güncellersin.</p>

        <label className="block mb-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sipariş miktarı ({product.unit})</span>
          <input
            type="number" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)}
            className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
            placeholder="Örn: 50"
          />
        </label>

        <label className="block mb-2">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tedarikçi adı (opsiyonel)</span>
          <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)} className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
        </label>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Beklenen teslim</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Birim maliyet</span>
            <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800" />
          </label>
        </div>

        <label className="block mb-3">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Not (opsiyonel)</span>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800" />
        </label>

        {error && <div className="text-xs text-rose-600 mb-2">⚠️ {error}</div>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 text-sm py-2 rounded-lg border border-slate-200 hover:bg-slate-50">Vazgeç</button>
          <button onClick={() => void save()} disabled={saving} className="flex-1 text-sm py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50">
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
