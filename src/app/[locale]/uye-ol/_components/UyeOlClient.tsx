"use client";

/**
 * /[locale]/uye-ol — Yeni üye reklam landing (client-side render).
 *
 * Server wrapper (../page.tsx) tenant-aware WA deep link metnini hesaplar
 * ve `waText` olarak verir (Sprint Foundation flag-gated):
 *   - Flag KAPALI veya emlak: "Üye olmak istiyorum"
 *   - Flag AÇIK + bayi: "BAYI: Üye olmak istiyorum"
 *   - Flag AÇIK + diğer tenant'lar: "MARKET: ...", "OTEL: ..." vb.
 *
 * Davranış device'a göre:
 *   - Mobile: wa.me deep link butonu
 *   - Desktop: aynı wa.me URL'ini QR olarak göster
 */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { ArrowRight } from "lucide-react";

const WA_BOT = "31644967207";

interface UyeOlClientProps {
  /** WA pre-fill text — server tarafında tenant prefix ile birleştirilir. */
  waText: string;
  /** Tenant-aware sade marka adı — header'da gösterilir (örn. "UPU Bayi"). */
  brandName: string;
}

export default function UyeOlClient({ waText, brandName }: UyeOlClientProps) {
  const t = useTranslations("signup");
  const locale = useLocale();

  const waDeepLink = `https://wa.me/${WA_BOT}?text=${encodeURIComponent(waText)}`;

  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  // Faz 7.0 — KVKK consent checkbox (kayıt için zorunlu)
  const [agreed, setAgreed] = useState(false);
  // Faz 7.1a — Hizmet Şartları onayı (kayıt için zorunlu)
  const [agreedTos, setAgreedTos] = useState(false);
  const canProceed = agreed && agreedTos;
  // Faz 9.1 — mobilde 3sn sonra "WhatsApp açılmadı mı?" fallback linki
  const [showFallback, setShowFallback] = useState(false);
  // Faz 9.2 — logged-in user direkt /panel'e redirect; auth check tamamlanmadan
  // signup formu render edilmez.
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/panel/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.success) {
          window.location.replace(`/${locale}/panel`);
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isMobile !== true) return;
    const timer = window.setTimeout(() => setShowFallback(true), 3000);
    return () => window.clearTimeout(timer);
  }, [isMobile]);

  // Fix 3 — Web signup'ta KVKK + ToS checkbox onayı localStorage'a yazılır;
  // bot organic-signup → panel mount akışında auto-accept tetiklenir
  // (duplicate KVKK modal görünmesin). 24 saat TTL flag.
  function persistSignupConsent() {
    if (!canProceed) return;
    try {
      const payload = JSON.stringify({
        kvkk_accepted_at: new Date().toISOString(),
        tos_accepted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      window.localStorage.setItem("upu_signup_consent", payload);
    } catch {
      /* private mode / quota — sessiz */
    }
  }

  // QR canvas — callback ref. authChecked → isMobile sırasıyla render
  // tetiklenince DOM'a giren canvas anında çizilir; useEffect deps race'i
  // ortadan kalkar (Faz 9.1/9.2 fix).
  const canvasRefCb = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node || isMobile !== false) return;
      void QRCode.toCanvas(node, waDeepLink, {
        width: 280,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    },
    [isMobile, waDeepLink],
  );

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between">
        <a href={`/${locale}`} className="flex items-center gap-2">
          <span className="text-lg font-semibold text-slate-900 dark:text-white">{brandName}</span>
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t("title")}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {t("subtitle")}
            </p>
          </div>

          {isMobile === null ? (
            <div className="h-72 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse" />
          ) : isMobile ? (
            <div className="space-y-2">
              <a
                href={canProceed ? waDeepLink : "#"}
                onClick={
                  canProceed
                    ? () => persistSignupConsent()
                    : (e) => e.preventDefault()
                }
                aria-disabled={!canProceed}
                className={`flex items-center justify-between gap-3 w-full px-5 py-4 rounded-2xl bg-emerald-500 text-white font-semibold shadow-lg transition ${
                  canProceed
                    ? "hover:bg-emerald-600 active:scale-[0.98]"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                <span>{t("cta_button")}</span>
                <ArrowRight className="w-5 h-5" strokeWidth={2.4} />
              </a>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("cta_hint")}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t("mobile_hint")}
              </p>
              {showFallback && (
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
                  {t("app_not_opened")}{" "}
                  <a
                    href={waDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => persistSignupConsent()}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {t("web_link")}
                  </a>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="inline-block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <canvas ref={canvasRefCb} className="block mx-auto" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {t("qr_label")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("cta_hint")}
                </p>
              </div>
              <a
                href={canProceed ? waDeepLink : "#"}
                onClick={
                  canProceed
                    ? () => persistSignupConsent()
                    : (e) => e.preventDefault()
                }
                target={canProceed ? "_blank" : undefined}
                rel={canProceed ? "noopener noreferrer" : undefined}
                aria-disabled={!canProceed}
                className={`inline-block text-sm ${
                  canProceed
                    ? "text-emerald-600 dark:text-emerald-400 hover:underline"
                    : "text-slate-400 dark:text-slate-600 cursor-not-allowed"
                }`}
              >
                {t("web_fallback")}
              </a>
            </div>
          )}

          {/* KVKK + ToS consent — Faz 7.0 / 7.1a. Buton iki onaya da bağlı. */}
          {isMobile !== null && (
            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-emerald-600 flex-shrink-0"
                />
                <span className="leading-relaxed">
                  <a
                    href={`/${locale}/aydinlatma-metni`}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {t("kvkk_link")}
                  </a>
                  {t("kvkk_consent_text")}
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={agreedTos}
                  onChange={(e) => setAgreedTos(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-emerald-600 flex-shrink-0"
                />
                <span className="leading-relaxed">
                  <a
                    href={`/${locale}/hizmet-sartlari`}
                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {t("tos_link")}
                  </a>
                  {t("tos_consent_text")}
                </span>
              </label>
            </div>
          )}

          <p className="text-xs text-center text-slate-400 dark:text-slate-500 pt-2">
            {t("already_member")}{" "}
            <a
              href={`/${locale}/giris`}
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {t("login_link")}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
