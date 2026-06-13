"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Globe, Save, ExternalLink, Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { HeroBanner, Skeleton } from "@/components/banking";

interface PublicSettings {
  hero_title?: string;
  hero_subtitle?: string;
  description?: string;
  address?: string;
  gallery_urls?: string[];
  amenities?: string[];
  contact?: { phone?: string; email?: string };
}

interface HotelData {
  id: string;
  name: string;
  slug: string | null;
  public_settings: PublicSettings;
  web_published: boolean;
}

export default function OtelWebsitePage() {
  const sp = useSearchParams();
  const token = sp.get("t") || sp.get("token");
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [slug, setSlug] = useState("");
  const [webPublished, setWebPublished] = useState(false);
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [newAmenity, setNewAmenity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/website${qs}`, { credentials: "same-origin" })
      .then(r => r.json())
      .then(d => {
        if (d?.error) { setError(d.error); return; }
        const h = d.hotel;
        if (!h) return;
        setHotel(h);
        setSlug(h.slug || "");
        setWebPublished(h.web_published);
        const s = h.public_settings || {};
        setHeroTitle(s.hero_title || "");
        setHeroSubtitle(s.hero_subtitle || "");
        setDescription(s.description || "");
        setAddress(s.address || "");
        setPhone(s.contact?.phone || "");
        setEmail(s.contact?.email || "");
        setGallery(s.gallery_urls || []);
        setAmenities(s.amenities || []);
      })
      .catch(e => setError(e?.message || "Hata"));
  }, [token]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const body: any = {
        slug: slug.toLowerCase().trim(),
        web_published: webPublished,
        hero_title: heroTitle.trim() || undefined,
        hero_subtitle: heroSubtitle.trim() || undefined,
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        contact: { phone: phone.trim(), email: email.trim() },
        gallery_urls: gallery,
        amenities,
      };
      if (token) body.token = token;
      const r = await fetch("/api/otel-panel/website", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d?.error) { setError(d.error); return; }
      setHotel(d.hotel);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/tr/o/${slug}` : "";

  return (
    <div className="space-y-5">
      <HeroBanner
        title="Web Sitesi"
        subtitle="Otelinizin halka açık sayfası ve online rezervasyon motoru. Slug ayarlayın, yayına alın, paylaşın."
        Icon={Globe}
      />

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          Kaydedildi.
        </div>
      )}

      {!hotel ? (
        <div className="space-y-3">
          <Skeleton height="h-32" />
          <Skeleton height="h-40" />
        </div>
      ) : (
        <form onSubmit={save} className="space-y-4">
          {/* Slug + Publish */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Yayın Ayarları</h3>

            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Slug (URL adresi) *</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">/o/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="caretta-pansiyon"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Sadece küçük harf, rakam ve tire. Boşluk kullanmayın.</p>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={webPublished} onChange={e => setWebPublished(e.target.checked)} />
              <span className="text-slate-700 dark:text-slate-300">Web sayfasını yayına al (misafirler görsün)</span>
            </label>

            {slug && (
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 text-xs">
                <div className="text-slate-500 dark:text-slate-400 mb-1">Public URL</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-slate-700 dark:text-slate-300 truncate">{publicUrl}</code>
                  {webPublished && hotel.web_published && (
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shrink-0">
                      <ExternalLink className="w-3 h-3" /> Aç
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Hero */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Karşılama (Hero)</h3>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Başlık</span>
              <input type="text" value={heroTitle} onChange={e => setHeroTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder={hotel.name} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Alt başlık</span>
              <input type="text" value={heroSubtitle} onChange={e => setHeroSubtitle(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Konforlu konaklama için bugün rezervasyon yapın" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Adres</span>
              <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Antalya, Kemer..." />
            </label>
          </section>

          {/* Description */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Hakkımızda</h3>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Otelinizi tanıtan birkaç paragraf..." />
          </section>

          {/* Gallery */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Galeri</h3>
            <div className="flex gap-2">
              <input type="url" value={newGalleryUrl} onChange={e => setNewGalleryUrl(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="https://..." />
              <button type="button" onClick={() => { if (newGalleryUrl) { setGallery([...gallery, newGalleryUrl]); setNewGalleryUrl(""); } }}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Ekle
              </button>
            </div>
            {gallery.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {gallery.map((url, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                    <button type="button" onClick={() => setGallery(gallery.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Amenities */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Olanaklar</h3>
            <div className="flex gap-2">
              <input type="text" value={newAmenity} onChange={e => setNewAmenity(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="WiFi, Kahvaltı, Otopark..." />
              <button type="button" onClick={() => { if (newAmenity) { setAmenities([...amenities, newAmenity]); setNewAmenity(""); } }}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium inline-flex items-center gap-1">
                <Plus className="w-4 h-4" /> Ekle
              </button>
            </div>
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {amenities.map((a, i) => (
                  <div key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300">
                    {a}
                    <button type="button" onClick={() => setAmenities(amenities.filter((_, j) => j !== i))}
                      className="text-rose-500 hover:text-rose-700">×</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Contact */}
          <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">İletişim</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Telefon</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="+90 ..." />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">E-posta</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="info@..." />
              </label>
            </div>
          </section>

          {/* Save */}
          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Değişiklikleri Kaydet
          </button>
        </form>
      )}
    </div>
  );
}
