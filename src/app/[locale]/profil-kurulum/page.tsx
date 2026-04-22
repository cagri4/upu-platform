"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";
type Status = "loading" | "form" | "saving" | "done" | "error";

export default function ProfilKurulumPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [officeName, setOfficeName] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [briefingEnabled, setBriefingEnabled] = useState(true);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/setup/init?token=${encodeURIComponent(token)}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        if (d.profile?.display_name) setDisplayName(d.profile.display_name);
        if (d.profile?.office_name) setOfficeName(d.profile.office_name);
        if (d.profile?.location) setLocation(d.profile.location);
        if (d.profile?.email) setEmail(d.profile.email);
        if (d.profile?.experience_years) setExperienceYears(d.profile.experience_years);
        setStatus("form");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { setError("Ad soyad gerekli."); return; }
    setStatus("saving"); setError("");
    try {
      const res = await fetch(`/api/profil/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          display_name: displayName.trim(),
          office_name: officeName.trim(),
          location: location.trim(),
          email: email.trim(),
          experience_years: experienceYears.trim(),
          briefing_enabled: briefingEnabled,
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
    <div className="text-5xl mb-3">🎉</div>
    <h1 className="text-xl font-bold mb-2">Hazırsın!</h1>
    <p className="text-slate-600 text-sm mb-6">Profilin kaydedildi. WhatsApp'a dönüp devam edelim.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}?text=${encodeURIComponent("başladım")}`}
      className="block bg-green-600 text-white px-6 py-4 rounded-xl font-semibold text-lg">💬 WhatsApp'a Dön</a>
  </Center>;

  const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-3 mb-4 text-base text-slate-900 placeholder:text-slate-500";
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">👤</div>
          <h1 className="text-xl font-bold">Profil Bilgileri</h1>
          <p className="text-blue-100 text-sm mt-1">Sunumlarda imza olarak kullanacağım.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad *</label>
            <input required type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ahmet Yılmaz" className={inputCls} />
            <label className="block text-sm font-medium text-slate-700 mb-1">Ofis / Şirket</label>
            <input type="text" value={officeName} onChange={e => setOfficeName(e.target.value)} placeholder="ABC Emlak" className={inputCls} />
            <label className="block text-sm font-medium text-slate-700 mb-1">Çalıştığınız bölge</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Bodrum Merkez" className={inputCls} />
            <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ahmet@canemlak.com" className={inputCls} />
            <label className="block text-sm font-medium text-slate-700 mb-1">Tecrübe (yıl)</label>
            <input type="number" min="0" value={experienceYears} onChange={e => setExperienceYears(e.target.value)} placeholder="5" className={inputCls} />
            <label className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <input type="checkbox" checked={briefingEnabled} onChange={e => setBriefingEnabled(e.target.checked)} className="w-5 h-5 accent-indigo-600" />
              <span className="text-sm text-slate-700">Her sabah durum raporu göndersin mi?</span>
            </label>
          </section>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}
          <button type="submit" disabled={status === "saving"}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95">
            {status === "saving" ? "Kaydediliyor..." : "✅ Kaydet ve WhatsApp'a Dön"}
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
