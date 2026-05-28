"use client";

/**
 * /[locale]/uye-ol — OTP-first signup client.
 *
 * Layout (Faz 6.7 — OTP-first refactor):
 *   1) [PRIMARY] Telefon ile üye ol — 2-step OTP form (PhoneOtpForm)
 *      - Step 1: phone → /api/auth/otp/request (purpose=signup)
 *      - Step 2: 6-digit code → /api/auth/otp/verify → boş profile oluşur +
 *        cookie attach + redirect /<locale>/profil-kurulum
 *   2) [SECONDARY] "veya WhatsApp ile başla" divider
 *   3) Mevcut wa.me deep-link / desktop QR akışı (bot organic-signup için
 *      backward-compat)
 *
 * Server wrapper tenant-aware brandName + waText + locale prop'larını geçer.
 * Auth check ((/api/panel/me) korunur — logged-in kullanıcı /tr/panel'e
 * yönlendirilir.
 */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { ArrowRight } from "lucide-react";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";

const WA_BOT = "31644967207";

interface UyeOlClientProps {
  waText: string;
  brandName: string;
  panelPath: string;
}

export default function UyeOlClient({ waText, brandName, panelPath }: UyeOlClientProps) {
  const t = useTranslations("signup");
  const locale = useLocale();

  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/panel/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.success) {
          window.location.replace(panelPath);
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
  }, [panelPath]);

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

  const waDeepLink = `https://wa.me/${WA_BOT}?text=${encodeURIComponent(waText)}`;

  const canvasRefCb = useCallback(
    (node: HTMLCanvasElement | null) => {
      if (!node || isMobile !== false) return;
      void QRCode.toCanvas(node, waDeepLink, {
        width: 240,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      });
    },
    [isMobile, waDeepLink],
  );

  const otpLocale = (["tr", "en", "nl"] as const).includes(locale as "tr") ? (locale as "tr" | "en" | "nl") : "tr";

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
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t("title")}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Telefon numaranı yaz, WhatsApp&apos;a kod gelsin. Saniyeler içinde üye ol.
            </p>
          </div>

          {/* PRIMARY — telefon ile üye ol */}
          <PhoneOtpForm
            mode="signup"
            locale={otpLocale}
            alternateHref={`/${locale}/giris`}
            alternateLabel="Giriş yap →"
          />

          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span>veya WhatsApp ile başla</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* SECONDARY — wa.me deep-link / desktop QR (bot organic-signup) */}
          {isMobile === null ? (
            <div className="h-32 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse" />
          ) : isMobile ? (
            <div className="space-y-2 text-center">
              <a
                href={waDeepLink}
                className="flex items-center justify-between gap-3 w-full px-5 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-slate-900 dark:text-white font-medium shadow-sm active:scale-[0.98] transition"
              >
                <span className="flex items-center gap-3">
                  <WhatsAppGlyph className="w-5 h-5 text-emerald-500" />
                  {t("cta_button")}
                </span>
                <ArrowRight className="w-5 h-5 text-slate-400" strokeWidth={2.4} />
              </a>
              {showFallback && (
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                  {t("app_not_opened")}{" "}
                  <a
                    href={waDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {t("web_link")}
                  </a>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <div className="inline-block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
                <canvas ref={canvasRefCb} className="block mx-auto" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("qr_label")} — telefonun kamerası ile tara
              </p>
              <a
                href={waDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {t("web_fallback")}
              </a>
            </div>
          )}

          {/* Implicit accept — KVKK + ToS link'leri her zaman görünür */}
          {isMobile !== null && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed text-center px-2">
              Kayıt olarak{" "}
              <a
                href={`/${locale}/aydinlatma-metni`}
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {t("kvkk_link")}
              </a>
              {" "}ve{" "}
              <a
                href={`/${locale}/hizmet-sartlari`}
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {t("tos_link")}
              </a>
              {"'nı kabul etmiş sayılırsınız."}
            </p>
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

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
