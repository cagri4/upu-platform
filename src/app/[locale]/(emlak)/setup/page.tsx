"use client";

/**
 * /setup — mobile-first onboarding form (legacy magic-link era).
 * Save sonrası emlak paneline yönlendirir (eski WA-back akışı kaldırıldı).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/banking";

const PANEL_PATH = "/tr/panel";

const PROPERTY_TYPES = [
  { id: "hepsi", label: "Hepsi" },
  { id: "daire", label: "Daire" },
  { id: "villa", label: "Villa" },
  { id: "mustakil", label: "Müstakil" },
  { id: "arsa", label: "Arsa" },
  { id: "rezidans", label: "Rezidans" },
  { id: "dukkan", label: "Dükkan" },
  { id: "buro_ofis", label: "Büro / Ofis" },
];

const REGIONS = [
  { id: "bodrum", label: "Bodrum" },
];

type Status = "loading" | "form" | "saving" | "done" | "error";

export default function SetupPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");

  // Save success → 2sn sonra panele otomatik redirect.
  useEffect(() => {
    if (status !== "done") return;
    const handle = setTimeout(() => {
      const dest = token ? `${PANEL_PATH}?t=${encodeURIComponent(token)}` : PANEL_PATH;
      window.location.replace(dest);
    }, 2000);
    return () => clearTimeout(handle);
  }, [status, token]);
  const [error, setError] = useState("");

  // Search criteria
  const [region, setRegion] = useState("bodrum");
  const [propertyType, setPropertyType] = useState("hepsi");
  const [listingType, setListingType] = useState("hepsi");
  const [listedBy, setListedBy] = useState("hepsi");

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [briefingEnabled, setBriefingEnabled] = useState(true);

  useEffect(() => {
    // Cookie session veya legacy ?token= akışı — token yoksa cookie ile devam etmeyi dene.
    const tokenQs = token ? `?token=${encodeURIComponent(token)}` : "";
    fetch(`/api/setup/init${tokenQs}`, { credentials: "same-origin" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setStatus("error");
          setError(data.error || "Link doğrulanamadı.");
          return;
        }
        // Pre-fill if profile has data
        if (data.profile?.display_name) setDisplayName(data.profile.display_name);
        if (data.profile?.office_name) setOfficeName(data.profile.office_name);
        if (data.profile?.location) setLocation(data.profile.location);
        if (data.profile?.email) setEmail(data.profile.email);
        if (data.profile?.experience_years) setExperienceYears(data.profile.experience_years);
        setStatus("form");
      })
      .catch(() => {
        setStatus("error");
        setError("Bağlantı hatası. Tekrar deneyin.");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Ad soyad gerekli.");
      return;
    }
    setStatus("saving");
    setError("");

    try {
      const res = await fetch(`/api/setup/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token,
          display_name: displayName.trim(),
          office_name: officeName.trim(),
          location: location.trim(),
          email: email.trim(),
          experience_years: experienceYears.trim(),
          briefing_enabled: briefingEnabled,
          region, property_type: propertyType, listing_type: listingType, listed_by: listedBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("form");
        setError(data.error || "Kaydedilemedi.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("form");
      setError("Bağlantı hatası. Tekrar deneyin.");
    }
  }

  if (status === "loading") {
    return <LoadingState label="Link doğrulanıyor" />;
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Hata</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
          <a href={PANEL_PATH} className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium">Panele dön</a>
        </div>
      </div>
    );
  }

  if (status === "done") {
    const dest = token ? `${PANEL_PATH}?t=${encodeURIComponent(token)}` : PANEL_PATH;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Hazırsın!</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">Profiliniz kaydedildi. Emlak paneliniz yükleniyor…</p>
          <a
            href={dest}
            data-testid="panele-git"
            className="block bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl font-semibold text-lg shadow-lg active:scale-95 transition"
          >
            🏠 Panele Git
          </a>
          <p className="text-slate-400 text-xs mt-4">Otomatik yönlendirilmezsen butona tıkla.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">👋</div>
          <h1 className="text-xl font-bold">Hoşgeldin!</h1>
          <p className="text-blue-100 text-sm mt-1">1-2 dakikada kurulumu bitirip panele geçiyoruz.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Search criteria */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-1">🔍 Arama Kriterleri</h2>
            <p className="text-xs text-slate-500 mb-4">Her sabah sana uygun yeni ilanları göstereceğim.</p>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Bölge</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 mb-4 text-base">
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mülk Tipi</label>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 mb-4 text-base">
              {PROPERTY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">İlan Tipi</label>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { id: "satilik", label: "Satılık" },
                { id: "kiralik", label: "Kiralık" },
                { id: "hepsi", label: "Hepsi" },
              ].map((o) => (
                <button type="button" key={o.id} onClick={() => setListingType(o.id)}
                  className={`py-3 rounded-lg text-sm font-medium border-2 ${listingType === o.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"}`}>
                  {o.label}
                </button>
              ))}
            </div>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Kimin ilanları</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "sahibi", label: "Sahibinden" },
                { id: "emlakci", label: "Emlak Ofisi" },
                { id: "hepsi", label: "Hepsi" },
              ].map((o) => (
                <button type="button" key={o.id} onClick={() => setListedBy(o.id)}
                  className={`py-3 rounded-lg text-xs font-medium border-2 ${listedBy === o.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"}`}>
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          {/* Section 2: Profile */}
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-1">👤 Profil Bilgileri</h2>
            <p className="text-xs text-slate-500 mb-4">Sunumlarda imza olarak kullanacağım.</p>

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ad Soyad *</label>
            <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ahmet Yılmaz"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 mb-4 text-base" />

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ofis / Şirket</label>
            <input type="text" value={officeName} onChange={(e) => setOfficeName(e.target.value)}
              placeholder="ABC Emlak"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 mb-4 text-base" />

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Çalıştığınız bölge</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Bodrum Merkez"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 mb-4 text-base" />

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmet@canemlak.com"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 mb-4 text-base" />

            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tecrübe (yıl)</label>
            <input type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)}
              placeholder="5"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-3 mb-4 text-base" />

            <label className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 rounded-lg p-3">
              <input type="checkbox" checked={briefingEnabled} onChange={(e) => setBriefingEnabled(e.target.checked)}
                className="w-5 h-5 accent-indigo-600" />
              <span className="text-sm text-slate-700 dark:text-slate-300">Her sabah durum raporu göndersin mi?</span>
            </label>
          </section>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 px-4 py-3 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          )}

          <button type="submit" disabled={status === "saving"}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95 transition">
            {status === "saving" ? "Kaydediliyor..." : "✅ Kaydet ve Panele Git"}
          </button>
        </form>
      </div>
    </div>
  );
}
