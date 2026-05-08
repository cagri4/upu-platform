"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";

interface Product { id: string; name: string; price: number }
interface Dealer { id: string; name: string }

export default function BayiKampanyaPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "price">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<"all" | "selected">("all");
  const [selectedDealers, setSelectedDealers] = useState<Set<string>>(new Set());
  const [broadcast, setBroadcast] = useState(0);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/bayi-kampanya/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setProducts(d.products || []);
        setDealers(d.dealers || []);
        // Default: today → today+14
        const today = new Date().toISOString().slice(0, 10);
        const plus14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        setStartDate(today); setEndDate(plus14);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  }

  async function save() {
    if (!name.trim()) { setError("Kampanya adı girin."); return; }
    if (!startDate || !endDate) { setError("Tarihleri girin."); return; }
    if (Number(discountValue) <= 0) { setError("İndirim değeri 0'dan büyük olmalı."); return; }
    if (selectedProducts.size === 0) { setError("En az bir ürün seçin."); return; }
    if (target === "selected" && selectedDealers.size === 0) {
      setError("En az bir bayi seçin veya 'Tüm bayiler' işaretleyin.");
      return;
    }
    setError("");
    setStatus("saving");

    try {
      const res = await fetch(`/api/bayi-kampanya/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          description: description.trim() || null,
          start_date: startDate,
          end_date: endDate,
          discount_type: discountType,
          discount_value: Number(discountValue),
          product_ids: Array.from(selectedProducts),
          target,
          dealer_ids: target === "selected" ? Array.from(selectedDealers) : [],
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Kaydedilemedi."); return; }
      setBroadcast(d.broadcast || 0);
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
    <div className="text-4xl mb-3">🎉</div>
    <h1 className="text-xl font-bold mb-2">Kampanya başlatıldı!</h1>
    <p className="text-slate-600 text-sm mb-4">
      {broadcast > 0 ? `${broadcast} bayiye WhatsApp duyurusu gitti.` : "Kampanya kaydedildi."}
    </p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-orange-600 to-pink-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">📢</div>
          <h1 className="text-xl font-bold">Kampanya Oluştur</h1>
          <p className="text-orange-100 text-sm mt-1">Ürün seç, indirim belirle, bayilere duyur.</p>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Kampanya Adı *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Örn. Nisan Fırsatları"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Açıklama</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} placeholder="Kısa kampanya açıklaması"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Başlangıç</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bitiş</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">İndirim Tipi</label>
            <div className="grid grid-cols-2 gap-2">
              {(["percent", "price"] as const).map(t => (
                <button key={t} type="button" onClick={() => setDiscountType(t)}
                  className={`py-2 rounded-lg text-sm font-medium border-2 ${discountType === t ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-700 border-slate-300"}`}>
                  {t === "percent" ? "% Yüzde" : "₺ Sabit Tutar"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">İndirim Değeri *</label>
            <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
              min={0.01} step={discountType === "percent" ? 1 : 0.01}
              placeholder={discountType === "percent" ? "Örn. 10" : "Örn. 50"}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800">Ürünler</h2>
            <span className="text-xs text-slate-500">{selectedProducts.size} seçili</span>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {products.map(p => (
              <label key={p.id}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${selectedProducts.has(p.id) ? "bg-orange-50 border-orange-300" : "bg-white border-slate-200"}`}>
                <input type="checkbox" checked={selectedProducts.has(p.id)}
                  onChange={() => toggle(selectedProducts, setSelectedProducts, p.id)}
                  className="w-4 h-4 accent-orange-600" />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-slate-500">{new Intl.NumberFormat("tr-TR").format(p.price)} ₺</span>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-2">Hedef Bayiler</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(["all", "selected"] as const).map(t => (
              <button key={t} type="button" onClick={() => setTarget(t)}
                className={`py-2 rounded-lg text-sm font-medium border-2 ${target === t ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-700 border-slate-300"}`}>
                {t === "all" ? "Tüm bayiler" : "Seçili bayiler"}
              </button>
            ))}
          </div>
          {target === "selected" && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {dealers.map(d => (
                <label key={d.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm ${selectedDealers.has(d.id) ? "bg-orange-50 border-orange-300" : "bg-white border-slate-200"}`}>
                  <input type="checkbox" checked={selectedDealers.has(d.id)}
                    onChange={() => toggle(selectedDealers, setSelectedDealers, d.id)}
                    className="w-4 h-4 accent-orange-600" />
                  <span className="flex-1 truncate">{d.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button onClick={save} disabled={status === "saving"}
          className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95">
          {status === "saving" ? "Kaydediliyor..." : "📤 Kampanyayı Başlat"}
        </button>

        {error && <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm shadow-lg">⚠️ {error}</div>}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
