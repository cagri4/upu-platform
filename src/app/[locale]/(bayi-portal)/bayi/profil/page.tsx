"use client";

/**
 * Bayi Profil (Faz 2 Sprint D).
 *
 * - Ad soyad, e-posta, sabah brief tercihi
 * - Google hesap bağla (varsa rozet, yoksa /api/auth/google/start?mode=link)
 * - Çıkış butonu
 *
 * Faz 4'te ek roller (kullanıcı yönetimi, çoklu cihaz) panel ayarlarına gider.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { User, Mail, Phone, LogOut, Check, AlertCircle } from "lucide-react";

interface Profile {
  displayName: string;
  whatsappPhone: string;
  email: string | null;
  briefingEnabled: boolean;
  googleLinked: boolean;
  googleEmail: string | null;
  role: string;
}

export default function BayiProfilPage() {
  const params = useParams();
  const router = useRouter();
  const locale = typeof params?.locale === "string" ? params.locale : "tr";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // Form
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [briefing, setBriefing] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bayi/profil", { credentials: "same-origin" });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Yüklenemedi.");
        return;
      }
      setProfile(d.profile);
      setDisplayName(d.profile.displayName || "");
      setEmail(d.profile.email || "");
      setBriefing(!!d.profile.briefingEnabled);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setSavedMsg("");
    setError("");
    try {
      const res = await fetch("/api/bayi/profil", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          email: email || null,
          briefing_enabled: briefing,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) {
        setError(d.error || "Kaydedilemedi.");
        return;
      }
      setSavedMsg("Kaydedildi.");
      load();
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(""), 2000);
    }
  }

  async function logout() {
    if (!confirm("Çıkış yapılsın mı?")) return;
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.push(`/${locale}/giris`);
  }

  function linkGoogle() {
    const next = `/${locale}/bayi/profil`;
    window.location.href = `/api/auth/google/start?mode=link&next=${encodeURIComponent(next)}`;
  }

  if (loading) {
    return <div className="p-6 text-center text-sm text-slate-500">Yükleniyor…</div>;
  }
  if (error && !profile) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {error}
      </div>
    );
  }
  if (!profile) return null;

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Profilim</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kimlik bilgileri ve hesap bağlantıları.
        </p>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {savedMsg}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <User className="h-4 w-4 text-indigo-600" />
            Kimlik
          </h2>
          <div className="mt-3 space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Ad Soyad</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">
                <Phone className="-mt-px mr-1 inline h-3 w-3" />
                WhatsApp telefon
              </span>
              <input
                type="text"
                value={profile.whatsappPhone}
                disabled
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 tabular-nums"
              />
              <span className="text-[11px] text-slate-400">
                Telefon değişimi için destek ile iletişime geç.
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">
                <Mail className="-mt-px mr-1 inline h-3 w-3" />
                E-posta (opsiyonel)
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@market.com"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={briefing}
                onChange={(e) => setBriefing(e.target.checked)}
                className="accent-indigo-600"
              />
              <span className="text-slate-700">Sabah hoşgeldin briefi al</span>
            </label>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Hesap Bağlantıları</h2>
          <div className="mt-3 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">Google hesabı</p>
                  <p className="text-xs text-slate-500">
                    Bağlıysan e-posta + Google ile alternatif giriş yapabilirsin.
                  </p>
                  {profile.googleLinked && profile.googleEmail && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      <Check className="h-3 w-3" />
                      {profile.googleEmail}
                    </p>
                  )}
                </div>
                {!profile.googleLinked ? (
                  <button
                    onClick={linkGoogle}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Bağla
                  </button>
                ) : (
                  <span className="text-xs text-emerald-700">Bağlı</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="flex items-start gap-1">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Şu an birincil giriş yöntemin WhatsApp OTP. Google'ı bağlasan
                bile WhatsApp girişi çalışmaya devam eder.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Çıkış</h2>
          <p className="mt-1 text-xs text-slate-500">
            Bu cihazdaki oturumu sonlandırır. Tekrar giriş için WhatsApp OTP
            veya Google (bağlıysa) kullanılır.
          </p>
          <button
            onClick={logout}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
          >
            <LogOut className="h-4 w-4" />
            Çıkış Yap
          </button>
        </section>
      </div>
    </div>
  );
}
