"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ReturnButtons } from "@/components/return-buttons";

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

interface Tracking {
  id: string;
  name: string;
  neighborhoods: string[];
  property_types: string[];
  listing_type: string | null;
  price_min: number | null;
  price_max: number | null;
  active: boolean;
  created_at: string;
}

interface SonucLead {
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

interface SonucState {
  status: "loading" | "ready" | "error";
  leads: SonucLead[];
  error?: string;
  matched?: number;
  total_today?: number;
}

type View = "list" | "form";
type Status = "loading" | "ready" | "saving" | "error";

export default function TakipPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [items, setItems] = useState<Tracking[]>([]);

  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [listingType, setListingType] = useState<string>("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");

  // Per-row in-flight ops
  const [busyId, setBusyId] = useState<string | null>(null);

  // Sonuç expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sonucByTakip, setSonucByTakip] = useState<Record<string, SonucState>>({});

  async function loadList() {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    try {
      const res = await fetch(`/api/takip/init?t=${encodeURIComponent(token)}`);
      const d = await res.json();
      if (!res.ok) { setStatus("error"); setError(d.error || "Yüklenemedi."); return; }
      setItems(d.trackings || []);
      setStatus("ready");
    } catch {
      setStatus("error"); setError("Bağlantı hatası.");
    }
  }

  useEffect(() => { void loadList(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  function startNew() {
    setEditId(null);
    setName(""); setNeighborhoods([]); setPropertyTypes([]);
    setListingType(""); setPriceMin(""); setPriceMax("");
    setError("");
    setView("form");
  }

  function startEdit(t: Tracking) {
    setEditId(t.id);
    setName(t.name || "");
    setNeighborhoods(t.neighborhoods || []);
    setPropertyTypes(t.property_types || []);
    setListingType(t.listing_type || "");
    setPriceMin(t.price_min ? String(t.price_min) : "");
    setPriceMax(t.price_max ? String(t.price_max) : "");
    setError("");
    setView("form");
  }

  function toggleNeighborhood(n: string) {
    setNeighborhoods(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  }
  function toggleType(t: string) {
    setPropertyTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving"); setError("");
    try {
      const res = await fetch("/api/takip/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          ...(editId ? { id: editId } : {}),
          name: name.trim() || (editId ? undefined : "Takibim"),
          neighborhoods,
          property_types: propertyTypes,
          listing_type: listingType || null,
          price_min: priceMin ? Number(priceMin) : null,
          price_max: priceMax ? Number(priceMax) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus("ready"); setError(d.error || "Kaydedilemedi."); return; }
      await loadList();
      setView("list");
    } catch {
      setStatus("ready"); setError("Bağlantı hatası.");
    }
  }

  async function handleToggle(id: string, current: boolean) {
    setBusyId(id);
    try {
      await fetch("/api/takip/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id, active: !current }),
      });
      await loadList();
    } finally { setBusyId(null); }
  }

  async function fetchSonuc(id: string) {
    setSonucByTakip(p => ({ ...p, [id]: { status: "loading", leads: [] } }));
    try {
      const r = await fetch(`/api/takip/sonuc?id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok) {
        setSonucByTakip(p => ({ ...p, [id]: { status: "error", leads: [], error: d.error || "Yüklenemedi." } }));
        return;
      }
      setSonucByTakip(p => ({ ...p, [id]: {
        status: "ready",
        leads: d.leads || [],
        matched: d.matched ?? 0,
        total_today: d.total_today ?? 0,
      } }));
    } catch {
      setSonucByTakip(p => ({ ...p, [id]: { status: "error", leads: [], error: "Bağlantı hatası." } }));
    }
  }

  function toggleSonuc(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!sonucByTakip[id]) void fetchSonuc(id);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu takibi silmek istediğinize emin misiniz?")) return;
    setBusyId(id);
    try {
      await fetch("/api/takip/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, id }),
      });
      await loadList();
    } finally { setBusyId(null); }
  }

  if (status === "loading") return <Center><div className="text-4xl mb-3">⏳</div><p>Yükleniyor...</p></Center>;
  if (status === "error") return <Center>
    <div className="text-4xl mb-3">⚠️</div><h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;

  // ── FORM VIEW ──────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="max-w-md mx-auto p-4">
          <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white rounded-2xl p-5 mb-5">
            <div className="text-3xl mb-1">🎯</div>
            <h1 className="text-xl font-bold">{editId ? "Takibi Düzenle" : "Takip Ekle"}</h1>
            <p className="text-orange-100 text-sm mt-1">
              Her sabah senin kriterine uyan yeni sahibi ilanlar WhatsApp&apos;a gelsin.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-medium text-slate-900 mb-2">İsim *</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Yalıkavak villa kiralık"
                className="w-full border border-slate-300 rounded-lg px-3 py-3 text-base"
              />
              <p className="text-xs text-slate-500 mt-1">Listede tanımak için kısa etiket.</p>
            </section>

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

            <div className="flex gap-2">
              <button type="submit" disabled={status === "saving"}
                className="flex-1 bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95 transition">
                {status === "saving" ? "Kaydediliyor..." : (editId ? "✅ Güncelle" : "✅ Kaydet")}
              </button>
              <button type="button" onClick={() => { setView("list"); setError(""); }}
                className="flex items-center justify-center bg-white border border-slate-300 text-slate-700 px-4 py-4 rounded-xl text-sm font-medium hover:bg-slate-50 active:scale-95 transition whitespace-nowrap">
                ← Geri
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-orange-600 to-red-600 text-white rounded-2xl p-5">
        <div className="text-3xl mb-1">🎯</div>
        <h1 className="text-xl font-bold">Takiplerim</h1>
        <p className="text-orange-100 text-sm mt-1">{items.length} takip{items.filter(t => t.active).length > 0 ? ` · ${items.filter(t => t.active).length} aktif` : ""}</p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
          🏠 Bu sayfada son 24 saatte sadece mülk sahipleri tarafından paylaşılan ilanlar yer alır.
        </p>
        <p className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 leading-relaxed">
          🔔 Bu panelde oluşturacağınız takipler her sabah WhatsApp&apos;ınıza mesaj olarak gönderilir.
        </p>
      </div>

      <button
        onClick={startNew}
        className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-4 rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition font-semibold"
      >
        ➕ Takip Ekle
      </button>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-3">🎯</div>
          <p className="font-semibold text-slate-900 mb-1">Şu an takip yok</p>
          <p className="text-slate-500 text-sm">İlk takibinizi eklemek için yukarıdaki butonu kullanın.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(t => {
            const summary = [
              t.neighborhoods.length > 0 ? t.neighborhoods.join(", ") : "Tüm Bodrum",
              t.property_types.length > 0 ? t.property_types.map(pt => PROPERTY_TYPES.find(p => p.id === pt)?.label || pt).join(", ") : "Tüm tipler",
              t.listing_type === "satilik" ? "Satılık" : t.listing_type === "kiralik" ? "Kiralık" : "Hepsi",
            ].join(" · ");
            const priceRange = t.price_min || t.price_max
              ? `${t.price_min ? new Intl.NumberFormat("tr-TR").format(t.price_min) : "0"} – ${t.price_max ? new Intl.NumberFormat("tr-TR").format(t.price_max) : "∞"} ₺`
              : null;
            const sonuc = sonucByTakip[t.id];
            const isExpanded = expandedId === t.id;
            return (
              <div key={t.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-slate-900 truncate">{t.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${t.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                      {t.active ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{summary}</p>
                  {priceRange && <p className="text-xs text-slate-500 mt-1">💰 {priceRange}</p>}
                </div>
                <div className="border-t border-slate-100 grid grid-cols-4">
                  <button
                    onClick={() => void handleToggle(t.id, t.active)}
                    disabled={busyId === t.id}
                    className="py-3 text-xs font-medium text-amber-700 hover:bg-amber-50 active:bg-amber-100 transition disabled:opacity-50"
                  >
                    {t.active ? "⏸ Durdur" : "▶️ Aktif"}
                  </button>
                  <button
                    onClick={() => startEdit(t)}
                    className="py-3 text-xs font-medium text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 transition border-l border-slate-100"
                  >
                    ✏️ Düzenle
                  </button>
                  <button
                    onClick={() => void handleDelete(t.id)}
                    disabled={busyId === t.id}
                    className="py-3 text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition border-l border-slate-100 disabled:opacity-50"
                  >
                    🗑 {busyId === t.id ? "..." : "Sil"}
                  </button>
                  <button
                    onClick={() => toggleSonuc(t.id)}
                    aria-expanded={isExpanded}
                    className={`py-3 text-xs font-medium border-l border-slate-100 transition ${isExpanded ? "bg-emerald-50 text-emerald-800" : "text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100"}`}
                  >
                    📊 Sonuç {isExpanded ? "▾" : "▸"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-3">
                    {sonuc?.status === "loading" && (
                      <div className="text-center py-4 text-sm text-slate-500">⏳ Yükleniyor...</div>
                    )}
                    {sonuc?.status === "error" && (
                      <div className="text-center py-4 text-sm text-red-600">⚠️ {sonuc.error}</div>
                    )}
                    {sonuc?.status === "ready" && sonuc.leads.length === 0 && (
                      <div className="text-center py-4 text-sm text-slate-500">
                        Bugün eşleşme yok.
                        {(sonuc.total_today ?? 0) > 0 && (
                          <span className="block text-xs text-slate-400 mt-1">
                            Bodrum&apos;da {sonuc.total_today} ilan var ama kriterinize uyan yok.
                          </span>
                        )}
                      </div>
                    )}
                    {sonuc?.status === "ready" && sonuc.leads.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600 mb-1">
                          Son 24 saatte <strong>{sonuc.matched}</strong> eşleşme:
                        </p>
                        {sonuc.leads.map(l => {
                          const priceStr = l.price
                            ? `${new Intl.NumberFormat("tr-TR").format(l.price)} ₺`
                            : "Fiyat ?";
                          const specs = [l.rooms, l.area ? `${l.area}m²` : null].filter(Boolean).join(" · ");
                          return (
                            <a
                              key={l.source_id}
                              href={l.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block bg-white rounded-lg p-3 shadow-sm hover:bg-emerald-50 transition"
                            >
                              <p className="text-sm font-medium text-slate-900 leading-tight line-clamp-2">{l.title}</p>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-600 mt-1">
                                {l.location_neighborhood && <span>📍 {l.location_neighborhood}</span>}
                                {specs && <span>{specs}</span>}
                                <span className="font-semibold text-stone-900">💰 {priceStr}</span>
                              </div>
                              <p className="text-xs text-emerald-700 mt-1 truncate">🔗 sahibinden&apos;de aç →</p>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ReturnButtons token={token || null} botPhone={BOT_WA_NUMBER} />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
