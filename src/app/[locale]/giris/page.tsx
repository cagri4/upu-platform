/**
 * /tr/giris — 2 buton login sayfası (Faz 6.3).
 *
 *   1) WhatsApp ile bağlan → /tr/qr-giris (mevcut QR akışı)
 *   2) Google ile gir     → /api/auth/google/start?next=<next>
 *
 * Error toast: ?error=<code>&hint=<wa_first|...> insanca mesaja çevrilir.
 * Faz 6.2 fix sonrası login mode tüm hata redirect'leri /tr/giris'e geliyor.
 */
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, AlertTriangle } from "lucide-react";

function GirisInner() {
  const params = useSearchParams();
  const error = params.get("error");
  const hint = params.get("hint");
  const next = params.get("next") || "/tr/panel";

  const errorMessage = mapErrorToMessage(error, hint);
  const googleHref = `/api/auth/google/start?next=${encodeURIComponent(next)}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between">
        <a href="/tr" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-slate-900 dark:text-white">UPU Emlak</span>
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Hoş geldin
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Hesabına giriş yapmak için bir yöntem seç
            </p>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
              <AlertTriangle
                className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5"
                strokeWidth={2.2}
              />
              <p className="text-sm text-rose-700 dark:text-rose-300 leading-relaxed">
                {errorMessage}
              </p>
            </div>
          )}

          {/* WA buton — primary */}
          <a
            href="/tr/qr-giris"
            className="flex items-center justify-between gap-3 w-full px-5 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-lg active:scale-[0.98] transition"
          >
            <span className="flex items-center gap-3">
              <WhatsAppGlyph className="w-6 h-6" />
              WhatsApp ile bağlan
            </span>
            <ArrowRight className="w-5 h-5" strokeWidth={2.4} />
          </a>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            <span>veya</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Google buton — secondary */}
          <a
            href={googleHref}
            className="flex items-center justify-center gap-3 w-full px-5 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-slate-900 dark:text-white font-medium shadow-sm active:scale-[0.98] transition"
          >
            <GoogleGlyph className="w-5 h-5" />
            Google ile gir
          </a>

          <p className="text-xs text-center text-slate-400 dark:text-slate-500 px-4 leading-relaxed">
            Yeni misin? WhatsApp ile bağlanarak hemen başla.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function GirisPage() {
  return (
    <Suspense fallback={null}>
      <GirisInner />
    </Suspense>
  );
}

function mapErrorToMessage(error: string | null, hint: string | null): string | null {
  if (!error) return null;
  switch (error) {
    case "no_account":
      return hint === "wa_first"
        ? "Bu Google hesabı sistemimizde kayıtlı değil. Önce WhatsApp ile bağlan, sonra panel ayarlarından Google hesabını ekleyebilirsin."
        : "Hesap bulunamadı.";
    case "oauth_init":
      return "Google ile bağlantı başlatılamadı. Lütfen tekrar dene.";
    case "missing_code":
      return "Google doğrulama bilgisi alınamadı. Lütfen tekrar dene.";
    case "oauth_exchange":
      return "Google ile doğrulama başarısız. Lütfen tekrar dene.";
    case "oauth_no_email":
      return "Google hesabından e-posta okunamadı. Hesap ayarlarını kontrol et.";
    case "link_unauthorized":
      return "Oturum süresi dolmuş. Lütfen tekrar bağlan.";
    case "login_required":
      return "Önce giriş yapmalısın.";
    default:
      return "Beklenmedik bir hata oluştu. Lütfen tekrar dene.";
  }
}

/** Google G logo (4 renk official). */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

/** WhatsApp logo (currentColor, beyaz buton üstünde). */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
