"use client";

/**
 * CookieBanner — Faz 7.1a.
 *
 * Bottom fixed banner; `cookie_consent_v1` cookie yoksa görünür.
 * Üç aksiyon: "Hepsini kabul et" (all), "Yalnızca gerekli" (necessary),
 * "Ayarlar" (toggle modu — analytics opsiyonel). Seçim 1 yıl TTL ile cookie'ye
 * yazılır; sonraki açılışta gösterilmez.
 *
 * Cookie değeri: "all" veya "necessary". MVP — sadece banner state, server
 * tarafında bu cookie'ye dayanan analitik/3rd-party script şu an yok.
 */

import { useEffect, useState } from "react";
import { Cookie, Settings as SettingsIcon, X } from "lucide-react";

const COOKIE_NAME = "cookie_consent_v1";
const COOKIE_MAX_AGE_DAYS = 365;

type ConsentValue = "all" | "necessary";

function readConsent(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const val = decodeURIComponent(match[1]);
  return val === "all" || val === "necessary" ? val : null;
}

function writeConsent(value: ConsentValue) {
  if (typeof document === "undefined") return;
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  const isProd = typeof window !== "undefined" && window.location.hostname.endsWith("upudev.nl");
  const domain = isProd ? "; Domain=.upudev.nl" : "";
  const secure = isProd ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${domain}${secure}`;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setVisible(true);
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    writeConsent("all");
    setVisible(false);
  };
  const acceptNecessary = () => {
    writeConsent("necessary");
    setVisible(false);
  };
  const saveSettings = () => {
    writeConsent(analytics ? "all" : "necessary");
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Çerez tercihleri"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:pb-4"
    >
      <div className="mx-auto w-full max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <div className="flex-1 space-y-1">
            <h2 className="text-sm font-semibold">Çerez tercihleri</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Hizmetin çalışması için zorunlu çerezler kullanırız. İstatistik çerezlerini
              kullanmak için onayınızı rica ediyoruz.{" "}
              <a
                href="/tr/aydinlatma-metni"
                className="text-emerald-300 hover:underline"
              >
                Detaylar
              </a>
            </p>
          </div>
        </div>

        {settingsOpen && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-800/60">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Gerekli</p>
                <p className="text-[11px] text-slate-400">Hizmet için zorunlu</p>
              </div>
              <input
                type="checkbox"
                checked
                disabled
                className="w-4 h-4 rounded accent-emerald-500 opacity-70 cursor-not-allowed"
              />
            </div>
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-800/60 cursor-pointer">
              <div className="space-y-0.5">
                <p className="text-xs font-medium">İstatistik</p>
                <p className="text-[11px] text-slate-400">Kullanım analizi (opsiyonel)</p>
              </div>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500"
              />
            </label>
          </div>
        )}

        {settingsOpen ? (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.4} />
              Vazgeç
            </button>
            <button
              type="button"
              onClick={saveSettings}
              className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition"
            >
              Seçimi kaydet
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={acceptAll}
              className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition order-1 sm:order-3"
            >
              Hepsini kabul et
            </button>
            <button
              type="button"
              onClick={acceptNecessary}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition order-2"
            >
              Yalnızca gerekli
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition flex items-center justify-center gap-1.5 order-3 sm:order-1"
            >
              <SettingsIcon className="w-3.5 h-3.5" strokeWidth={2.4} />
              Ayarlar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
