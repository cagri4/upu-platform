"use client";

/**
 * /[locale]/profil-kurulum-mini — Multi-tenant minimal onboarding.
 *
 * Multi-tenant fix (2026-06-05): emlak'ın eski profil-kurulum sayfası
 * sektör-spesifik alanlar içeriyordu ve diğer SaaS'larda da bu form
 * gösteriliyordu (izolasyon ihlali). Bu sayfa SaaS-agnostic alanları
 * (ad soyad + e-posta + brifing tercihi) sağlar.
 *
 * /api/profil/save backend guard sektör alanlarını yoksayar — defense-
 * in-depth. Save sonrası 2sn auto-redirect kullanıcının kendi paneline
 * (saas_type → panel path eşlemesi).
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Status = "loading" | "form" | "saving" | "done" | "error" | "no_auth";

// saas_type → panel path eşlemesi (qr.ts TENANT_PANEL ile aynı).
const PANEL_PATH_BY_SAAS: Record<string, string> = {
  emlak: "/tr/panel",
  bayi: "/tr/bayi-panel",
  market: "/tr/market-panelim",
  otel: "/tr/otel-panel",
  restoran: "/tr/restoran-panel",
  siteyonetim: "/tr/site",
  muhasebe: "/tr/panel",
};

function panelPathFor(saasType: string | null): string {
  if (!saasType) return "/tr/panel";
  return PANEL_PATH_BY_SAAS[saasType] || "/tr/panel";
}

export default function ProfilKurulumMiniPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "tr";
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [saasType, setSaasType] = useState<string | null>(null);

  // Save success → 2sn sonra tenant'ın panel'ine otomatik redirect.
  useEffect(() => {
    if (status !== "done") return;
    const dest = panelPathFor(saasType);
    const handle = setTimeout(() => {
      window.location.replace(dest);
    }, 2000);
    return () => clearTimeout(handle);
  }, [status, saasType]);

  // Profil mevcut bilgilerini yükle (display_name = telefon olarak başlamış olabilir).
  useEffect(() => {
    fetch("/api/setup/init", { credentials: "same-origin" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 401) {
            setStatus("no_auth");
            return;
          }
          setStatus("error");
          setError(d.error || "Profil yüklenemedi.");
          return;
        }
        const initialName = (d.profile?.display_name as string | undefined) || "";
        // signup'ta display_name = phone yazılır → kullanıcının değiştirmesi
        // için bunu boş bırak ki kendi adını girsin
        if (initialName && !/^[0-9+ ]+$/.test(initialName)) {
          setDisplayName(initialName);
        }
        const initialEmail = (d.profile?.email as string | undefined) || "";
        if (initialEmail) setEmail(initialEmail);
        if (typeof d.saas_type === "string") setSaasType(d.saas_type);
        setStatus("form");
      })
      .catch(() => {
        setStatus("error");
        setError("Bağlantı hatası.");
      });
  }, []);

  async function handleSave() {
    if (!displayName.trim() || displayName.trim().length < 2) {
      setError("Ad soyad gerekli (en az 2 karakter).");
      return;
    }
    setError("");
    setStatus("saving");
    try {
      const r = await fetch("/api/profil/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          display_name: displayName.trim(),
          email: email.trim() || null,
          briefing_enabled: briefingEnabled,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setStatus("error");
        setError(d.error || "Kaydedilemedi.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setError("Bağlantı hatası.");
    }
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm text-slate-500">
        Yükleniyor…
      </main>
    );
  }

  if (status === "no_auth") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Oturum bulunamadı. Giriş sayfasından tekrar dene.
          </p>
          <a href={`/${locale}/giris`} className="mt-3 inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg">
            Giriş Sayfası
          </a>
        </div>
      </main>
    );
  }

  if (status === "done") {
    const dest = panelPathFor(saasType);
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div
          data-testid="mini-done"
          className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl p-6 border border-emerald-200 dark:border-emerald-800/50 text-center space-y-3"
        >
          <h1 className="text-lg font-semibold text-emerald-700">✅ Profil tamamlandı</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Paneliniz yükleniyor…
          </p>
          <a
            href={dest}
            data-testid="panele-git"
            className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"
          >
            Panele Git
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
          <h1 className="text-lg font-semibold">Profilini tamamla</h1>
          <p className="text-indigo-100 text-xs mt-1">
            Tek seferlik temel bilgi — saniyeler içinde panel hazır.
            {saasType ? ` (${saasType})` : ""}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Ad Soyad <span className="text-rose-500">*</span>
            </label>
            <input
              data-testid="mini-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Adınız Soyadınız"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              E-posta <span className="text-slate-400 text-xs">(opsiyonel)</span>
            </label>
            <input
              data-testid="mini-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@firma.com"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              data-testid="mini-briefing"
              type="checkbox"
              checked={briefingEnabled}
              onChange={(e) => setBriefingEnabled(e.target.checked)}
              className="accent-indigo-600 w-4 h-4"
            />
            Sabah hoşgeldin mesajı al
          </label>

          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <button
            data-testid="mini-save"
            type="button"
            disabled={status === "saving" || !displayName.trim()}
            onClick={handleSave}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold"
          >
            {status === "saving" ? "Kaydediliyor…" : "Kaydet ve Panele Git"}
          </button>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center pt-1">
            Locale: <span className="font-mono">{locale}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
