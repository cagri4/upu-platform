"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  User,
  Camera,
  Building2,
  Globe,
  Loader2,
  AlertTriangle,
  Check,
  RotateCw,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { LoadingState } from "@/components/banking";

const BOT_WA_NUMBER = "31644967207";

type Status = "loading" | "form" | "saving" | "done" | "error";

const inputCls = "w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition";

/**
 * Subdomain → tenant panel path. qr.ts TENANT_PANEL ile senkron — client
 * server config import edemediği için hardcoded. Bilinmeyen host → emlak.
 */
function panelPathFromHost(): string {
  if (typeof window === "undefined") return "/tr/panel";
  const host = window.location.host;
  if (host.startsWith("retailai.")) return "/tr/bayi-panel";
  if (host.startsWith("marketai.")) return "/tr/market-panelim";
  if (host.startsWith("hotelai.")) return "/tr/otel-panel";
  if (host.startsWith("restoranai.")) return "/tr/restoran-panel";
  if (host.startsWith("residenceai.")) return "/tr/site";
  return "/tr/panel";
}

export default function ProfilDuzenlePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  // Tenant-aware panel "Geri" hedefi. host-based fallback — SSR sırasında
  // emlak default'una düşer ama tarayıcıda doğru tenant path'i alır.
  const panelBase = typeof window !== "undefined" ? panelPathFromHost() : "/tr/panel";
  const panelHref = token ? `${panelBase}?t=${encodeURIComponent(token)}` : panelBase;

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
    const tokenQs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/profilduzenle/init${tokenQs}`, { credentials: "same-origin" })
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
      const res = await fetch("/api/profilduzenle/upload-photo", { method: "POST", body: fd, credentials: "same-origin" });
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
        credentials: "same-origin",
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

  if (status === "loading") return <LoadingState label={token ? "Link doğrulanıyor" : "Hazırlanıyor"} />;
  if (status === "error") {
    return (
      <Center>
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Hata</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">{error}</p>
        <a
          href={`https://wa.me/${BOT_WA_NUMBER}`}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          <MessageCircle className="w-4 h-4" /> WhatsApp&apos;a dön
        </a>
      </Center>
    );
  }
  if (status === "done") {
    return (
      <DoneState
        title="Profil kaydedildi"
        subtitle="Web sayfanız hazır."
        panelHref={panelHref}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-32">
      <div className="max-w-md mx-auto p-4 space-y-5">
        {/* Hero */}
        <div className="flex items-center gap-3">
          <a
            href={panelHref}
            className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            aria-label="Geri"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
          </a>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profil Düzenle</h1>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
          Vereceğiniz bilgiler, oluşturulacak <strong className="text-slate-900 dark:text-white">web sayfanızda</strong> kullanılacak.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Section title="Profil Fotoğrafı" Icon={Camera}>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 flex items-center justify-center">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-400 dark:text-slate-500" strokeWidth={1.8} />
                )}
              </div>
              <div className="flex-1">
                <label className="block">
                  <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={photoUploading} className="hidden" />
                  <span
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border-2 border-dashed cursor-pointer transition ${
                      photoUploading
                        ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 animate-pulse"
                        : "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                    }`}
                  >
                    {photoUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Yükleniyor...</>
                    ) : photoUrl ? (
                      <><RotateCw className="w-4 h-4" /> Değiştir</>
                    ) : (
                      <><Camera className="w-4 h-4" /> Foto Ekle</>
                    )}
                  </span>
                </label>
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl("")} className="text-xs text-rose-600 dark:text-rose-400 mt-2 hover:underline">
                    Kaldır
                  </button>
                )}
                {photoError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {photoError}
                  </p>
                )}
              </div>
            </div>
          </Section>

          <Section title="Kişisel" Icon={User}>
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

          <Section title="Ofis & Tecrübe" Icon={Building2}>
            <Field label="Ofis Adresi">
              <input value={officeAddress} onChange={e => setOfficeAddress(e.target.value)} placeholder="Bodrum, Bitez Mah." className={inputCls} />
            </Field>
            <Field label="Tecrübe (yıl)">
              <input type="number" min="0" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} placeholder="örn. 8" className={inputCls} />
            </Field>
            <Field label="Kısa Biyografi (opsiyonel)">
              <textarea
                rows={4}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Ör: 15 yıllık emlak deneyimim var. Kuzey Bodrum bölgesinde uzmanım..."
                className={`${inputCls} resize-none`}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Kısa öz geçmiş + tecrübeleriniz + çalışma prensipleriniz.</p>
            </Field>
          </Section>

          <Section title="Web Sayfası" Icon={Globe}>
            <Field label="Sayfa kısa adı (URL)">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition">
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">upudev.nl/u/</span>
                <input
                  value={webSlug}
                  onChange={e => setWebSlug(e.target.value)}
                  placeholder="ahmet-yilmaz"
                  className="flex-1 bg-transparent text-base text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                />
              </div>
            </Field>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Boş bırakırsan adınızdan otomatik üretirim.
            </p>
          </Section>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} /> {error}
            </div>
          )}
        </form>
      </div>

      {/* Sticky bottom submit */}
      <StickyBottom>
        <button
          type="submit"
          onClick={handleSubmit}
          disabled={status === "saving"}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition"
        >
          <Check className="w-5 h-5" strokeWidth={2.5} />
          {status === "saving" ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </StickyBottom>
    </div>
  );
}

function Section({ title, Icon, children }: { title: string; Icon: typeof User; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StickyBottom({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-3 z-10">
      <div className="max-w-md mx-auto flex gap-2">{children}</div>
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

function DoneState({ title, subtitle, panelHref }: { title: string; subtitle: string; panelHref: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full shadow-sm border border-slate-200/70 dark:border-slate-800 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">{title}</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">{subtitle}</p>
        <div className="w-full space-y-2">
          <a href={panelHref} className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white text-center font-semibold py-4 rounded-2xl shadow-sm active:scale-[0.98] transition">
            Panele Dön
          </a>
          <a href={`https://wa.me/${BOT_WA_NUMBER}`} className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-center font-semibold py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.98] transition">
            <MessageCircle className="w-4 h-4" /> WhatsApp&apos;a Dön
          </a>
        </div>
      </div>
    </div>
  );
}
