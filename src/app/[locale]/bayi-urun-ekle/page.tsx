"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "ready" | "saving" | "done" | "error";

interface InitResp {
  categories: string[];
}

interface PhotoSlot {
  url: string;
  uploading: boolean;
  error?: string;
}

const UNITS: Array<{ id: string; label: string }> = [
  { id: "adet", label: "Adet" },
  { id: "kg", label: "Kg" },
  { id: "lt", label: "Litre" },
  { id: "m2", label: "m²" },
  { id: "m", label: "Metre" },
  { id: "kutu", label: "Kutu" },
  { id: "koli", label: "Koli" },
  { id: "palet", label: "Palet" },
  { id: "paket", label: "Paket" },
];

export default function BayiUrunEklePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [init, setInit] = useState<InitResp | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("adet");
  const [unitPrice, setUnitPrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [vatRate, setVatRate] = useState("21"); // NL default; TR kullanıcısı 20'ye değiştirir
  const [ean, setEan] = useState("");
  const [photos, setPhotos] = useState<PhotoSlot[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/bayi-urun-ekle/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setInit(d);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function uploadPhoto(file: File) {
    if (photos.length >= 5) {
      setError("En fazla 5 fotoğraf.");
      return;
    }
    const idx = photos.length;
    setPhotos(prev => [...prev, { url: "", uploading: true }]);

    const fd = new FormData();
    fd.append("token", token || "");
    fd.append("file", file);
    try {
      const res = await fetch(`/api/bayi-urun-ekle/upload-photo`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok || !d.url) {
        setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, uploading: false, error: d.error || "Yükleme hatası" } : p));
        return;
      }
      setPhotos(prev => prev.map((p, i) => i === idx ? { url: d.url, uploading: false } : p));
    } catch {
      setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, uploading: false, error: "Bağlantı hatası" } : p));
    }
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setError("");
    if (name.trim().length < 2) { setError("Ürün adı girin."); return; }
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price <= 0) { setError("Geçerli birim fiyat girin."); return; }

    setStatus("saving");
    const photoUrls = photos.filter(p => p.url).map(p => p.url);
    try {
      const res = await fetch(`/api/bayi-urun-ekle/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          code: code.trim() || undefined,
          category: category.trim() || undefined,
          unit,
          unit_price: price,
          stock_quantity: stockQty ? Number(stockQty) : 0,
          min_order: minOrder ? Number(minOrder) : 1,
          brand: brand.trim() || undefined,
          description: description.trim() || undefined,
          image_url: photoUrls[0] || undefined,
          images: photoUrls,
          vat_rate: vatRate ? Number(vatRate) : 0,
          ean: ean.trim() || undefined,
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
    <h1 className="text-xl font-bold mb-2">Ürün eklendi!</h1>
    <p className="text-slate-600 text-sm mb-4">Sıradaki adım WhatsApp&apos;a düştü.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm";

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">📦</div>
          <h1 className="text-xl font-bold">Ürün Ekle</h1>
          <p className="text-emerald-100 text-sm mt-1">Kataloğunuza ilk ürünü kaydedin.</p>
        </div>

        <Section title="🔴 Zorunlu">
          <Field label="Ürün Adı">
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Filli Boya İç Cephe Mat 15L" className={inputCls} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Birim">
              <select value={unit} onChange={e => setUnit(e.target.value)} className={inputCls}>
                {UNITS.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            </Field>
            <Field label="Birim Fiyat (₺)">
              <input type="number" min="0" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                placeholder="850" className={inputCls} required />
            </Field>
          </div>
        </Section>

        <Section title="📷 Fotoğraflar (en fazla 5)">
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden">
                {p.uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">⏳</div>
                ) : p.error ? (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-red-600 p-1 text-center">{p.error}</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                )}
                <button type="button" onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-white/90 text-red-600 w-6 h-6 rounded-full text-xs">✕</button>
              </div>
            ))}
            {photos.length < 5 && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-slate-300 rounded-lg text-2xl text-slate-400">
                ＋
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }} />
          <p className="text-[11px] text-slate-500 mt-2">İlk fotoğraf ana görsel olur.</p>
        </Section>

        <Section title="📋 Detay (opsiyonel)">
          <Field label="Ürün Kodu / SKU">
            <input value={code} onChange={e => setCode(e.target.value)}
              placeholder="Boş bırakın — addan otomatik üretilir" className={inputCls} />
          </Field>
          <Field label="Kategori">
            <input value={category} onChange={e => setCategory(e.target.value)}
              list="cat-list" placeholder="Boya / Vernik / Hırdavat..." className={inputCls} />
            <datalist id="cat-list">
              {(init?.categories || []).map(c => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Marka">
            <input value={brand} onChange={e => setBrand(e.target.value)}
              placeholder="Filli Boya / Bosch..." className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stok Adedi">
              <input type="number" min="0" value={stockQty} onChange={e => setStockQty(e.target.value)}
                placeholder="0" className={inputCls} />
            </Field>
            <Field label="Min. Sipariş">
              <input type="number" min="1" value={minOrder} onChange={e => setMinOrder(e.target.value)}
                placeholder="1" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="BTW / KDV Oranı">
              <select value={vatRate} onChange={e => setVatRate(e.target.value)} className={inputCls}>
                <option value="21">%21 (NL standart)</option>
                <option value="9">%9 (NL azaltılmış)</option>
                <option value="20">%20 (TR standart)</option>
                <option value="10">%10 (TR azaltılmış)</option>
                <option value="1">%1 (TR temel gıda)</option>
                <option value="0">%0 (vergi yok / ihracat)</option>
              </select>
            </Field>
            <Field label="EAN Barkod">
              <input value={ean} onChange={e => setEan(e.target.value)}
                placeholder="8 veya 13 hane" className={inputCls} inputMode="numeric" />
            </Field>
          </div>
          <Field label="Açıklama">
            <textarea rows={3} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Bayilerin göreceği özellik notları" className={inputCls} />
          </Field>
        </Section>

        <button onClick={save} disabled={status === "saving"}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60 active:scale-95 mt-2">
          {status === "saving" ? "Kaydediliyor..." : "📤 Ürünü Kaydet"}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 mb-3 space-y-3">
      <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
