/**
 * /tr/uye-ol — Yeni üye reklam landing (Faz 6.4).
 *
 * Davranış device'a göre:
 *   - Mobile (max-width: 768px): wa.me deep link butonu — WhatsApp açılır
 *   - Desktop: aynı wa.me URL'ini QR olarak göster — telefon kamerasıyla okut
 *
 * Bot tarafında prefilled mesaj "Üye olmak istiyorum" → mevcut onboarding
 * akışı tetiklenir. Bu sayfa yeni DB tokenı üretmez — mevcut
 * /tr/qr-giris ve panel_qr_tokens akışına DOKUNMAZ (o login içindi).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowRight } from "lucide-react";

const WA_BOT = "31644967207";
const WA_DEEP_LINK = `https://wa.me/${WA_BOT}?text=${encodeURIComponent("Üye olmak istiyorum")}`;

export default function UyeOlPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  // Faz 7.0 — KVKK consent checkbox (kayıt için zorunlu)
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    // Window resize / dev tools'ta cihaz simülasyonu için canlı dinle
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isMobile !== false || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, WA_DEEP_LINK, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  }, [isMobile]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between">
        <a href="/tr" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-slate-900 dark:text-white">UPU Emlak</span>
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Hemen başla
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              WhatsApp üzerinden 1 dakikada üye ol, AI destekli emlak ekibini kullan.
            </p>
          </div>

          {isMobile === null ? (
            <div className="h-72 rounded-2xl bg-slate-200/50 dark:bg-slate-800/50 animate-pulse" />
          ) : isMobile ? (
            <div className="space-y-3">
              <a
                href={agreed ? WA_DEEP_LINK : "#"}
                onClick={agreed ? undefined : (e) => e.preventDefault()}
                aria-disabled={!agreed}
                className={`flex items-center justify-between gap-3 w-full px-5 py-4 rounded-2xl bg-emerald-500 text-white font-semibold shadow-lg transition ${
                  agreed
                    ? "hover:bg-emerald-600 active:scale-[0.98]"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                <span>WhatsApp ile başla</span>
                <ArrowRight className="w-5 h-5" strokeWidth={2.4} />
              </a>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                WhatsApp açılır, &ldquo;Gönder&rdquo; demen yeterli.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="inline-block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <canvas ref={canvasRef} className="block mx-auto" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Telefon kameranla QR&apos;ı okut
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  WhatsApp açılır, &ldquo;Gönder&rdquo; demen yeterli.
                </p>
              </div>
              <a
                href={agreed ? WA_DEEP_LINK : "#"}
                onClick={agreed ? undefined : (e) => e.preventDefault()}
                target={agreed ? "_blank" : undefined}
                rel={agreed ? "noopener noreferrer" : undefined}
                aria-disabled={!agreed}
                className={`inline-block text-sm ${
                  agreed
                    ? "text-emerald-600 dark:text-emerald-400 hover:underline"
                    : "text-slate-400 dark:text-slate-600 cursor-not-allowed"
                }`}
              >
                veya WhatsApp Web&apos;de aç →
              </a>
            </div>
          )}

          {/* KVKK consent — Faz 7.0. Bağla butonu disabled until checked. */}
          {isMobile !== null && (
            <label className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-400 cursor-pointer text-left">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-emerald-600 flex-shrink-0"
              />
              <span className="leading-relaxed">
                <a
                  href="/tr/aydinlatma-metni"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  KVKK Aydınlatma Metni
                </a>
                &apos;ni okudum ve kişisel verilerimin işlenmesine onay veriyorum.
              </span>
            </label>
          )}

          <p className="text-xs text-center text-slate-400 dark:text-slate-500 pt-2">
            Zaten üye misin?{" "}
            <a
              href="/tr/giris"
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Giriş yap
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
