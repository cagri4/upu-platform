"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SahibindenLink } from "@/components/sahibinden-link";

const BOT_WA_NUMBER = "31644967207";

const PROPERTY_TYPES = [
  { id: "daire", label: "Daire", konut: true },
  { id: "villa", label: "Villa", konut: true },
  { id: "mustakil", label: "Müstakil", konut: true },
  { id: "rezidans", label: "Rezidans", konut: true },
  { id: "yazlik", label: "Yazlık", konut: true },
  { id: "arsa", label: "Arsa", konut: false },
  { id: "buro_ofis", label: "Büro/Ofis", konut: false },
  { id: "dukkan", label: "Dükkan", konut: false },
  { id: "otel", label: "Otel", konut: false },
  { id: "yali", label: "Yalı", konut: true },
];

const ROOMS = ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+1"];

type Status = "loading" | "form" | "searching" | "results" | "error";

interface Lead {
  source_id: string;
  source_url: string;
  title: string;
  type: string;
  listing_type: string;
  price: number | null;
  area: number | null;
  rooms: string | null;
  location_neighborhood: string | null;
}

export default function AraPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Lead[] | null>(null);

  const [listingType, setListingType] = useState<string>("satilik");
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/setup/init?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        setStatus("form");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  const showRooms = useMemo(() => {
    if (propertyTypes.length === 0) return false;
    return propertyTypes.some(t => PROPERTY_TYPES.find(p => p.id === t)?.konut);
  }, [propertyTypes]);

  function toggleType(t: string) {
    setError("");
    setPropertyTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function toggleRoom(r: string) {
    setRooms(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (propertyTypes.length === 0) { setError("En az 1 mülk tipi seç."); return; }
    setStatus("searching"); setError("");
    try {
      const res = await fetch(`/api/ara/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          listing_type: listingType,
          property_types: propertyTypes,
          price_min: priceMin ? Number(priceMin) : null,
          price_max: priceMax ? Number(priceMax) : null,
          rooms: showRooms && rooms.length > 0 ? rooms : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("form"); setError(d.error || "Arama yapılamadı."); return; }
      setResults(d.results || []);
      setStatus("results");
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

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🔍</div>
          <h1 className="text-xl font-bold">Hızlı Arama</h1>
          <p className="text-blue-100 text-sm mt-1">Kriterlerine uyan son 24 saatin sahibi ilanlarını göster.</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-5">
          {/* İlan tipi */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">İlan Tipi *</label>
            <div className="grid grid-cols-2 gap-2">
              {[{id:"satilik",label:"Satılık"},{id:"kiralik",label:"Kiralık"}].map(o => (
                <button type="button" key={o.id} onClick={() => setListingType(o.id)}
                  className={`py-3 rounded-lg text-sm font-medium border-2 ${listingType === o.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* Mülk Tipi */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Mülk Tipi * <span className="text-slate-400 text-xs">({propertyTypes.length} seçili)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROPERTY_TYPES.map(t => (
                <button type="button" key={t.id} onClick={() => toggleType(t.id)}
                  className={`py-2 rounded-lg text-xs font-medium border-2 ${propertyTypes.includes(t.id) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {/* Oda (koşullu: sadece konut tipi seçildiyse) */}
          {showRooms && (
            <section className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Oda Sayısı <span className="text-slate-400 text-xs">({rooms.length} seçili)</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {ROOMS.map(r => (
                  <button type="button" key={r} onClick={() => toggleRoom(r)}
                    className={`py-2 rounded-lg text-xs font-medium border-2 ${rooms.includes(r) ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300"}`}>
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Hiç seçmezsen tüm oda sayıları.</p>
            </section>
          )}

          {/* Fiyat */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-900 mb-2">Fiyat Aralığı (₺)</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="Min" min="0"
                className="border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900 placeholder:text-slate-400" />
              <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="Max" min="0"
                className="border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900 placeholder:text-slate-400" />
            </div>
          </section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

          <button type="submit" disabled={status === "searching"}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95">
            {status === "searching" ? "Aranıyor..." : "🔍 Ara"}
          </button>
        </form>

        {/* Sonuçlar */}
        {status === "results" && results && (
          <div className="mt-6 space-y-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-slate-900 mb-1">📋 Uyan İlanlar</h2>
              <p className="text-xs text-slate-500">{results.length} sonuç (son 24 saat)</p>
            </div>

            {results.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-slate-500 text-sm">
                Bu kriterle bugün yayınlanan sahibi ilan yok. Yarın sabah yeni liste gelecek.
              </div>
            ) : (
              results.map(r => (
                <div key={r.source_id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900 mb-1 leading-tight">{r.title}</h3>
                  <div className="text-sm text-slate-600 mb-2">
                    📍 {r.location_neighborhood || "Bodrum"}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm mb-2">
                    {r.rooms && <span className="text-slate-700">🏠 {r.rooms}</span>}
                    {r.area && <span className="text-slate-700">📐 {r.area} m²</span>}
                    {r.price && <span className="font-bold text-slate-900">💰 {new Intl.NumberFormat("tr-TR").format(r.price)} ₺</span>}
                  </div>
                  <SahibindenLink href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">
                    🔗 Sahibinden'de gör
                  </SahibindenLink>
                </div>
              ))
            )}

            <a
              href={`https://wa.me/${BOT_WA_NUMBER}`}
              className="block bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg text-center active:scale-95 mt-4"
            >
              💬 WhatsApp'a Dön
            </a>
            <p className="text-slate-400 text-xs text-center">WhatsApp'ta kalıcı takip için yeni mesaj bekliyor.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
