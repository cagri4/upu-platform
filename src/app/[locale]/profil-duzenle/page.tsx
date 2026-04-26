"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "form" | "saving" | "done" | "error";

export default function ProfilDuzenlePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [bio, setBio] = useState("");
  const [webSlug, setWebSlug] = useState("");

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    fetch(`/api/profilduzenle/init?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) { setStatus("error"); setError(d.error || "Link doğrulanamadı."); return; }
        const p = d.profile || {};
        setFullName(p.full_name || "");
        setPhone(p.phone || "");
        setEmail(p.email || "");
        setOfficeAddress(p.office_address || "");
        setPhotoUrl(p.photo_url || "");
        setYearsExperience(p.years_experience ? String(p.years_experience) : "");
        setBio(p.bio || "");
        setWebSlug(p.web_slug || "");
        setStatus("form");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError("");
    try {
      const fd = new FormData();
      fd.append("token", token || "");
      fd.append("file", file);
      const res = await fetch("/api/profilduzenle/upload-photo", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhotoError(d.error || `Hata ${res.status}`);
      } else if (d.url) {
        setPhotoUrl(d.url);
      }
    } catch {
      setPhotoError("Bağlantı hatası.");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 2) { setError("Ad soyad gerekli."); return; }
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/profilduzenle/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          office_address: officeAddress.trim(),
          photo_url: photoUrl,
          years_experience: yearsExperience ? Number(yearsExperience) : null,
          bio: bio.trim(),
          web_slug: webSlug.trim(),
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
    <div className="text-4xl mb-3">⚠️</div>
    <h1 className="text-xl font-bold mb-2">Hata</h1>
    <p className="text-slate-600 text-sm mb-4">{error}</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">WhatsApp&apos;a dön</a>
  </Center>;
  if (status === "done") return <Center>
    <div className="text-5xl mb-3">✨</div>
    <h1 className="text-xl font-bold mb-2">Profil kaydedildi!</h1>
    <p className="text-slate-600 text-sm mb-6">Web sayfanız WhatsApp&apos;a düşecek. WhatsApp&apos;a dönün.</p>
    <a href={`https://wa.me/${BOT_WA_NUMBER}`}
      className="block bg-green-600 text-white px-6 py-4 rounded-xl font-semibold text-lg">💬 WhatsApp&apos;a Dön</a>
  </Center>;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white rounded-2xl p-5 mb-5">
          <div className="text-3xl mb-1">🪪</div>
          <h1 className="text-xl font-bold">Profil Düzenle</h1>
          <p className="text-violet-100 text-sm mt-1">
            ℹ️ Verdiğiniz bilgiler birazdan oluşturacağımız <strong>kişisel web sayfanızda</strong> kullanılacak.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Section title="📷 Profil Fotoğrafı">
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-200 flex-shrink-0">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl text-slate-400">👤</div>
                )}
              </div>
              <div className="flex-1">
                <label className="block">
                  <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={photoUploading} className="hidden" />
                  <span className={`block text-center py-2.5 px-4 rounded-lg text-sm font-medium border-2 border-dashed cursor-pointer ${photoUploading ? "border-amber-400 bg-amber-50 text-amber-800 animate-pulse" : "border-violet-400 bg-violet-50 text-violet-700"}`}>
                    {photoUploading ? "⏳ Yükleniyor..." : photoUrl ? "🔄 Değiştir" : "📷 Foto Ekle"}
                  </span>
                </label>
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl("")} className="text-xs text-red-600 mt-2">Kaldır</button>
                )}
                {photoError && <p className="text-xs text-red-600 mt-1">⚠️ {photoError}</p>}
              </div>
            </div>
          </Section>

          <Section title="👤 Kişisel">
            <Field label="Ad Soyad *">
              <input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Ahmet Yılmaz" className={inputCls} />
            </Field>
            <Field label="Telefon">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="05XX XXX XX XX" className={inputCls} />
            </Field>
            <Field label="E-posta">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ornek@email.com" className={inputCls} />
            </Field>
          </Section>

          <Section title="🏢 Ofis & Tecrübe">
            <Field label="Ofis Adresi">
              <input value={officeAddress} onChange={e => setOfficeAddress(e.target.value)} placeholder="Bodrum, Bitez Mah." className={inputCls} />
            </Field>
            <Field label="Kaç yıllık tecrübeniz var?">
              <input type="number" min="0" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} placeholder="örn. 8" className={inputCls} />
            </Field>
            <Field label="Kısa Biyografi (opsiyonel)">
              <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} placeholder="Uzmanlık alanlarınız, çalışma tarzınız..." className={inputCls} />
            </Field>
          </Section>

          <Section title="🌐 Web Sayfası Adresi">
            <Field label="Kullanıcı adı (URL'de görünecek)">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 whitespace-nowrap">estateai.upudev.nl/u/</span>
                <input value={webSlug} onChange={e => setWebSlug(e.target.value)} placeholder="ahmet-yilmaz" className={inputCls} />
              </div>
            </Field>
            <p className="text-xs text-slate-500">Boş bırakırsan adınızdan otomatik üretirim.</p>
          </Section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>}

          <button type="submit" disabled={status === "saving"}
            className="w-full bg-violet-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-60 active:scale-95">
            {status === "saving" ? "Kaydediliyor..." : "✅ Profili Kaydet"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-3 text-base text-slate-900 placeholder:text-slate-400";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
    <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
    {children}
  </section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div>
    <label className="block text-sm font-medium text-slate-900 mb-2">{label}</label>
    {children}
  </div>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">{children}</div>
  </div>;
}
