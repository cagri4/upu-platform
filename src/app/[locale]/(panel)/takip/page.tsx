"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  BarChart3,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Home,
  MapPin,
  ArrowLeft,
  Check,
  ExternalLink,
} from "lucide-react";

import { ReturnButtons } from "@/components/return-buttons";
import { LoadingState } from "@/components/banking";

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

  if (status === "loading") return <LoadingState />;
  if (status === "error") {
    return (
      <Center>
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Hata</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
        <a
          href={`https://wa.me/${BOT_WA_NUMBER}`}
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          WhatsApp&apos;a dön
        </a>
      </Center>
    );
  }

  // ── FORM VIEW ──────────────────────────────────────────────────────
  if (view === "form") {
    const inputBase = "w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500";
    const chipBase = "py-2 px-2 rounded-lg text-xs font-medium border transition";
    const chipOn = "bg-emerald-600 text-white border-emerald-600";
    const chipOff = "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500";

    return (
      <div className="space-y-5 pb-24">
        <button
          type="button"
          onClick={() => { setView("list"); setError(""); }}
          className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Geri
        </button>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {editId ? "Takibi Düzenle" : "Takip Ekle"}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
          Her sabah senin kriterine uyan yeni sahibi ilanlar WhatsApp&apos;a gelsin.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">İsim *</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Yalıkavak villa kiralık"
              className={inputBase}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Listede tanımak için kısa etiket.</p>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
              Bölge <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">({neighborhoods.length} seçili)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BODRUM_SUBAREAS.map(n => (
                <button type="button" key={n} onClick={() => toggleNeighborhood(n)}
                  className={`${chipBase} ${neighborhoods.includes(n) ? chipOn : chipOff}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Hiç seçmezsen tüm Bodrum.</p>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
              Mülk Tipi <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">({propertyTypes.length} seçili)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROPERTY_TYPES.map(t => (
                <button type="button" key={t.id} onClick={() => toggleType(t.id)}
                  className={`${chipBase} ${propertyTypes.includes(t.id) ? chipOn : chipOff}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Hiç seçmezsen tüm tipler.</p>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">İlan Tipi</label>
            <div className="grid grid-cols-3 gap-2">
              {[{id:"",label:"Hepsi"},{id:"satilik",label:"Satılık"},{id:"kiralik",label:"Kiralık"}].map(o => (
                <button type="button" key={o.id || "all"} onClick={() => setListingType(o.id)}
                  className={`py-3 rounded-lg text-sm font-medium border transition ${listingType === o.id ? chipOn : chipOff}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-200/70 dark:border-slate-800">
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Fiyat Aralığı (₺)</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder="Min" min="0" className={inputBase} />
              <input type="number" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder="Max" min="0" className={inputBase} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Boş bırakırsan sınır yok.</p>
          </section>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={status === "saving"}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-4 rounded-xl font-semibold text-base shadow-sm active:scale-[0.98] transition">
              <Check className="w-5 h-5" strokeWidth={2.5} />
              {status === "saving" ? "Kaydediliyor..." : (editId ? "Güncelle" : "Kaydet")}
            </button>
            <button type="button" onClick={() => { setView("list"); setError(""); }}
              className="flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-4 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition whitespace-nowrap">
              <ArrowLeft className="w-4 h-4" strokeWidth={2.2} /> Geri
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────
  const activeCount = items.filter(t => t.active).length;
  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Takiplerim</h1>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
          {items.length} kayıt{activeCount > 0 ? ` · ${activeCount} aktif` : ""}
        </span>
      </div>

      <div className="space-y-2">
        <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl px-4 py-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
          <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
          Bu sayfada son 24 saatte sadece mülk sahipleri tarafından paylaşılan ilanlar yer alır.
        </div>
        <div className="bg-slate-100 dark:bg-slate-800/60 rounded-xl px-4 py-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
          <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
          Bu panelde oluşturacağınız takipler her sabah WhatsApp&apos;ınıza mesaj olarak gönderilir.
        </div>
      </div>

      <button
        onClick={startNew}
        className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
      >
        <Plus className="w-5 h-5" strokeWidth={2.5} />
        Takip Ekle
      </button>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
          <Target className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" strokeWidth={1.8} />
          <p className="font-semibold text-slate-900 dark:text-white mb-1">Şu an takip yok</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm">İlk takibinizi eklemek için yukarıdaki butonu kullanın.</p>
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
              <div key={t.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-800 overflow-hidden">
                <div className="p-4 flex gap-3">
                  <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Target className="w-5 h-5" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">{t.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                        t.active
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}>
                        {t.active ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{summary}</p>
                    {priceRange && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{priceRange}</p>
                    )}
                  </div>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 grid grid-cols-4">
                  <button
                    onClick={() => void handleToggle(t.id, t.active)}
                    disabled={busyId === t.id}
                    className="flex items-center justify-center gap-1 py-3 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition disabled:opacity-50"
                  >
                    {t.active ? (
                      <><Pause className="w-3.5 h-3.5" strokeWidth={2.2} /> Durdur</>
                    ) : (
                      <><Play className="w-3.5 h-3.5" strokeWidth={2.2} /> Aktif</>
                    )}
                  </button>
                  <button
                    onClick={() => startEdit(t)}
                    className="flex items-center justify-center gap-1 py-3 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition border-l border-slate-100 dark:border-slate-800"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={2.2} /> Düzenle
                  </button>
                  <button
                    onClick={() => void handleDelete(t.id)}
                    disabled={busyId === t.id}
                    className="flex items-center justify-center gap-1 py-3 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:bg-rose-100 transition border-l border-slate-100 dark:border-slate-800 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} /> {busyId === t.id ? "..." : "Sil"}
                  </button>
                  <button
                    onClick={() => toggleSonuc(t.id)}
                    aria-expanded={isExpanded}
                    className={`flex items-center justify-center gap-1 py-3 text-xs font-medium border-l border-slate-100 dark:border-slate-800 transition ${
                      isExpanded
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                        : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 active:bg-emerald-100"
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" strokeWidth={2.2} /> Sonuç
                    {isExpanded ? <ChevronUp className="w-3 h-3" strokeWidth={2.5} /> : <ChevronDown className="w-3 h-3" strokeWidth={2.5} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                    {sonuc?.status === "loading" && <LoadingState variant="inline" />}
                    {sonuc?.status === "error" && (
                      <div className="text-center py-4 text-sm text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2">
                        <AlertTriangle className="w-4 h-4" strokeWidth={2.2} /> {sonuc.error}
                      </div>
                    )}
                    {sonuc?.status === "ready" && sonuc.leads.length === 0 && (
                      <div className="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                        Bugün eşleşme yok.
                        {(sonuc.total_today ?? 0) > 0 && (
                          <span className="block text-xs text-slate-400 dark:text-slate-500 mt-1">
                            Bodrum&apos;da {sonuc.total_today} ilan var ama kriterinize uyan yok.
                          </span>
                        )}
                      </div>
                    )}
                    {sonuc?.status === "ready" && sonuc.leads.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                          Son 24 saatte <strong className="text-slate-900 dark:text-white">{sonuc.matched}</strong> eşleşme:
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
                              className="block bg-white dark:bg-slate-900 rounded-lg p-3 shadow-sm border border-slate-200/70 dark:border-slate-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition"
                            >
                              <p className="text-sm font-medium text-slate-900 dark:text-white leading-tight line-clamp-2">{l.title}</p>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400 mt-1 items-center">
                                {l.location_neighborhood && (
                                  <span className="flex items-center gap-0.5">
                                    <MapPin className="w-3 h-3" strokeWidth={2} /> {l.location_neighborhood}
                                  </span>
                                )}
                                {specs && <span>{specs}</span>}
                                <span className="font-semibold text-slate-900 dark:text-white">{priceStr}</span>
                              </div>
                              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 truncate flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" strokeWidth={2.2} /> sahibinden&apos;de aç
                              </p>
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
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        {children}
      </div>
    </div>
  );
}
