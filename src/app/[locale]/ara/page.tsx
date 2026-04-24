"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

const PROPERTY_TYPES = [
  { id: "hepsi", label: "Hepsi" },
  { id: "daire", label: "Daire" },
  { id: "villa", label: "Villa" },
  { id: "mustakil", label: "Müstakil" },
  { id: "arsa", label: "Arsa" },
  { id: "rezidans", label: "Rezidans" },
  { id: "dukkan", label: "Dükkan" },
  { id: "buro_ofis", label: "Büro/Ofis" },
];

const REGIONS = [{ id: "bodrum", label: "Bodrum" }];

type Status = "loading" | "form" | "saving" | "done" | "error";

interface Results {
  count: number;
  avgPrice: number;
  neighborhoods: { name: string; count: number }[];
}

export default function AraPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Results | null>(null);

  const [region, setRegion] = useState("bodrum");
  const [propertyType, setPropertyType] = useState("hepsi");
  const [listingType, setListingType] = useState("hepsi");
  const [listedBy, setListedBy] = useState("hepsi");

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving"); setError("");
    try {
      const res = await fetch(`/api/ara/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, region, property_type: propertyType, listing_type: listingType, listed_by: listedBy }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("form"); setError(d.error || "Arama yapılamadı."); return; }
      setResults({ count: d.count, avgPrice: d.avgPrice, neighborhoods: d.neighborhoods });
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

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🔍</div>
          <h1 className="text-xl font-bold">Arama Kriterleri</h1>
          <p className="text-blue-100 text-sm mt-1">Bölgende hangi ilanları izlemek istiyorsun?</p>
        </div>

        <form onSubmit={handleSearch} className="space-y-5">
          <section className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bölge</label>
              <select value={region} onChange={e => setRegion(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900">
                {REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mülk Tipi</label>
              <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900">
                {PROPERTY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">İlan Tipi</label>
              <div className="grid grid-cols-3 gap-2">
                {[{id:"satilik",label:"Satılık"},{id:"kiralik",label:"Kiralık"},{id:"hepsi",label:"Hepsi"}].map(o => (
                  <button type="button" key={o.id} onClick={() => setListingType(o.id)}
                    className={`py-3 rounded-lg text-sm font-medium border-2 ${listingType === o.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-300"}`}>{o.label}</button>
                ))}
              </div>
            </div>
          </section>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
            ℹ️ Size sadece *sahibi tarafından verilen* yeni ilanlar gelecek. Sahibinden linklerine tıklayarak kendi hesabınızla telefonu reveal edip arayabilirsiniz.
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

          {!results && (
            <button type="submit" disabled={status === "saving"}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95">
              {status === "saving" ? "Aranıyor..." : "🔍 Ara"}
            </button>
          )}
        </form>

        {results && (
          <div className="mt-6 space-y-4">
            <section className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <div className="text-4xl mb-2">🎯</div>
              <h2 className="font-bold text-slate-900 mb-2">Kriterler kaydedildi!</h2>
              <p className="text-sm text-slate-600">
                Her sabah 06:45'te kriterine uyan yeni sahibi ilanları sahibinden linkleriyle birlikte WhatsApp'a gönderiyoruz.
              </p>
            </section>

            <a
              href={`https://wa.me/${BOT_WA_NUMBER}?text=${encodeURIComponent("devam")}`}
              className="block bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg text-center active:scale-95"
            >
              💬 WhatsApp'a Dön
            </a>
            <p className="text-slate-400 text-xs text-center">Profil formu için bot size mesaj gönderdi — sohbete dönünce göreceksin.</p>
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
