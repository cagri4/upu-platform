"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

const BODRUM_SUBAREAS = [
  "Bodrum Merkez", "Yalıkavak", "Bitez", "Turgutreis",
  "Gündoğan", "Göltürkbükü", "Gümüşlük", "Konacık",
  "Yalı", "Mumcular", "Ortakent", "Kızılağaç",
];

const PROPERTY_TYPES = [
  { id: "daire", label: "Daire" },
  { id: "villa", label: "Villa" },
  { id: "mustakil", label: "Müstakil" },
  { id: "rezidans", label: "Rezidans" },
  { id: "yazlik", label: "Yazlık" },
  { id: "arsa", label: "Arsa" },
  { id: "buro_ofis", label: "Büro/Ofis" },
  { id: "dukkan", label: "Dükkan" },
  { id: "otel", label: "Otel" },
  { id: "yali", label: "Yalı" },
];

type Status = "loading" | "form" | "saving" | "done" | "error";

export default function TakipPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [listingType, setListingType] = useState<string>("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/takip/init?t=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        const c = d.criteria || {};
        setNeighborhoods(c.neighborhoods || []);
        setPropertyTypes(c.property_types || []);
        setListingType(c.listing_type || "");
        setPriceMin(c.price_min ? String(c.price_min) : "");
        setPriceMax(c.price_max ? String(c.price_max) : "");
        setStatus("form");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  function toggleNeighborhood(n: string) {
    setError("");
    setNeighborhoods(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  }

  function toggleType(t: string) {
    setError("");
    setPropertyTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving"); setError("");
    try {
      const res = await fetch(`/api/takip/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          neighborhoods,
          property_types: propertyTypes,
          listing_type: listingType || null,
          price_min: priceMin ? Number(priceMin) : null,
          price_max: priceMax ? Number(priceMax) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("form"); setError(d.error || "Kaydedilemedi."); return; }
      setStatus("done");
    } catch {
      setStatus("form"); setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div><h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp'a dön</a>
  </Center>;
  if (status === "done") return <Center>
    <div className="text-5xl mb-3">🎯</div>
    <h1 className="text-xl font-bold mb-2">Takip kaydedildi!</h1>
    <p className="text-slate-600 text-sm mb-6">Yarın sabah 06:45'te seçtiğin kriterlere uyan yeni sahibi ilanları WhatsApp'a göndereceğim.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`}
      className="block bg-green-600 text-white px-6 py-4 rounded-xl font-semibold text-lg">💬 WhatsApp'a Dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🎯</div>
          <h1 className="text-xl font-bold">Takip Kriterleri</h1>
          <p className="text-orange-100 text-sm mt-1">
            Her sabah senin kriterine uyan yeni sahibi ilanlar WhatsApp'a gelsin.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Bölge */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Bölge <span className="text-slate-400 text-xs">({neighborhoods.length} seçili)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BODRUM_SUBAREAS.map(n => (
                <button type="button" key={n} onClick={() => toggleNeighborhood(n)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border-2 ${neighborhoods.includes(n) ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-700 border-slate-300"}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Hiç seçmezsen tüm Bodrum.</p>
          </section>

          {/* Mülk Tipi */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Mülk Tipi <span className="text-slate-400 text-xs">({propertyTypes.length} seçili)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROPERTY_TYPES.map(t => (
                <button type="button" key={t.id} onClick={() => toggleType(t.id)}
                  className={`py-2 rounded-lg text-xs font-medium border-2 ${propertyTypes.includes(t.id) ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-700 border-slate-300"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Hiç seçmezsen tüm tipler.</p>
          </section>

          {/* İlan Tipi */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">İlan Tipi</label>
            <div className="grid grid-cols-3 gap-2">
              {[{id:"",label:"Hepsi"},{id:"satilik",label:"Satılık"},{id:"kiralik",label:"Kiralık"}].map(o => (
                <button type="button" key={o.id || "all"} onClick={() => setListingType(o.id)}
                  className={`py-3 rounded-lg text-sm font-medium border-2 ${listingType === o.id ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-700 border-slate-300"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* Fiyat Aralığı */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">Fiyat Aralığı (₺)</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="Min" min="0"
                className="border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900 placeholder:text-slate-400" />
              <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="Max" min="0"
                className="border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900 placeholder:text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mt-1">Boş bırakırsan sınır yok.</p>
          </section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

          <button type="submit" disabled={status === "saving"}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95">
            {status === "saving" ? "Kaydediliyor..." : "✅ Takibi Kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
