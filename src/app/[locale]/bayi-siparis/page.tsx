"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";

interface Product {
  id: string;
  name: string;
  unit_price: number;
  stock_quantity: number;
  category: string | null;
}

interface Dealer {
  id: string;
  name: string;
}

interface InitResp {
  isOwner: boolean;
  isDealer: boolean;
  presetDealerId: string | null;
  callerName: string;
  dealers: Dealer[];
  products: Product[];
}

interface LineItem {
  productId: string;
  quantity: number;
}

function fmtPrice(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

export default function BayiSiparisPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [init, setInit] = useState<InitResp | null>(null);

  const [dealerId, setDealerId] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/bayi-siparis/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setInit(d);
        if (d.presetDealerId) setDealerId(d.presetDealerId);
        else if (d.dealers.length === 1) setDealerId(d.dealers[0].id);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  const productIndex = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of init?.products || []) m.set(p.id, p);
    return m;
  }, [init]);

  const total = useMemo(() => {
    let t = 0;
    for (const line of lines) {
      const p = productIndex.get(line.productId);
      if (p) t += p.unit_price * line.quantity;
    }
    return t;
  }, [lines, productIndex]);

  function addLine() {
    const first = init?.products?.[0];
    if (!first) return;
    setLines(prev => [...prev, { productId: first.id, quantity: 1 }]);
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (!dealerId) { setError("Bayi seçin."); return; }
    const clean = lines.filter(l => l.productId && l.quantity > 0);
    if (clean.length === 0) { setError("En az bir ürün ekleyin."); return; }
    setError("");
    setStatus("saving");

    try {
      const res = await fetch(`/api/bayi-siparis/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          dealer_id: dealerId,
          items: clean.map(l => ({ product_id: l.productId, quantity: l.quantity })),
          notes: notes.trim() || null,
          delivery_date: deliveryDate || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Kaydedilemedi."); return; }
      setStatus("done");
    } catch {
      setStatus("ready");
      setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;

  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  if (status === "done") return <Center>
    <div className="text-4xl mb-3">✅</div>
    <h1 className="text-xl font-bold mb-2">Sipariş oluşturuldu!</h1>
    <p className="text-slate-600 text-sm mb-4">Onay mesajı WhatsApp&apos;a düştü.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">📦</div>
          <h1 className="text-xl font-bold">Sipariş Oluştur</h1>
          <p className="text-emerald-100 text-sm mt-1">
            {init?.isOwner ? "Bayi seç, ürünleri ekle, kaydet." : "Ürünleri seç, kaydet."}
          </p>
        </div>

        {/* Dealer */}
        <div className="bg-white rounded-2xl p-4 mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-2">Bayi</label>
          {init?.isDealer ? (
            <div className="text-sm font-medium text-slate-800">
              {init.dealers[0]?.name || "—"}
            </div>
          ) : (
            <select value={dealerId} onChange={e => setDealerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Bayi seçin...</option>
              {init?.dealers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800">Ürünler</h2>
            <button type="button" onClick={addLine}
              className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg">
              ➕ Ürün ekle
            </button>
          </div>

          {lines.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-4">Henüz ürün eklenmedi.</div>
          )}

          <div className="space-y-2">
            {lines.map((line, i) => {
              const p = productIndex.get(line.productId);
              return (
                <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <select value={line.productId}
                    onChange={e => updateLine(i, { productId: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                    {init?.products.map(pr => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name} — {fmtPrice(pr.unit_price)} ₺
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-600">Adet:</label>
                    <input type="number" min={1} value={line.quantity}
                      onChange={e => updateLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm" />
                    {p && (
                      <span className="text-xs text-slate-500 ml-auto">
                        {fmtPrice(p.unit_price * line.quantity)} ₺
                      </span>
                    )}
                    <button type="button" onClick={() => removeLine(i)}
                      className="text-red-500 text-sm ml-2">✕</button>
                  </div>
                  {p && p.stock_quantity < line.quantity && (
                    <div className="text-[11px] text-red-600">⚠️ Stok: {p.stock_quantity}</div>
                  )}
                </div>
              );
            })}
          </div>

          {lines.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between font-bold">
              <span className="text-sm text-slate-700">Toplam</span>
              <span className="text-lg text-emerald-700">{fmtPrice(total)} ₺</span>
            </div>
          )}
        </div>

        {/* Notes + delivery */}
        <div className="bg-white rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Not (opsiyonel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder="Özel talep veya açıklama"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Teslimat tarihi (opsiyonel)</label>
            <input type="date" value={deliveryDate}
              onChange={e => setDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        </div>

        <button onClick={save} disabled={status === "saving"}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95">
          {status === "saving" ? "Kaydediliyor..." : "📤 Siparişi Oluştur"}
        </button>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}

        <div className="mt-6 text-center">
          <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="text-xs text-slate-500 hover:underline">
            WhatsApp&apos;a geri dön
          </a>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
