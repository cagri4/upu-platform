"use client";

/**
 * Telefon + OTP login/signup formu — /tr/giris ve /tr/uye-ol kullanır.
 *
 * 2 adım:
 *   1) phone input → POST /api/auth/otp/request (purpose=login|signup,locale)
 *      → WA'ya 6 haneli kod gider (Meta upu_otp_giris template, COPY_CODE)
 *   2) code input → POST /api/auth/otp/verify
 *      → cookie session attach + redirect path
 *
 * Mobil:
 *   - inputMode="tel" → numpad
 *   - inputMode="numeric" + autoComplete="one-time-code" → iOS/Android SMS
 *     autofill prompt'u (WA kodu için manuel girilebilir ama UX tutarlı)
 *
 * Cooldown: kod gönderildikten sonra 30sn "Yeniden gönder" disabled.
 */
import { useState, useEffect, useRef, type FormEvent } from "react";
import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

type Mode = "login" | "signup";
type Step = "phone" | "code";
type Locale = "tr" | "en" | "nl";

interface PhoneOtpFormProps {
  mode: Mode;
  locale: Locale;
  /** Login mode'da "/<locale>/uye-ol" — no_account error'da CTA olarak gösterilir. */
  alternateHref: string;
  /** Mevcut kullanıcı için karşıt sayfa label'i ("Üye ol" veya "Giriş yap"). */
  alternateLabel: string;
}

const RESEND_COOLDOWN_SEC = 30;

export function PhoneOtpForm({
  mode,
  locale,
  alternateHref,
  alternateLabel,
}: PhoneOtpFormProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") {
      // hafif gecikme: SSR/animation race
      window.setTimeout(() => codeInputRef.current?.focus(), 50);
    }
  }, [step]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, purpose: mode, locale }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setError(data.error ?? "send_failed");
        return;
      }
      setStep("code");
      setCode("");
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, purpose: mode, locale }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        error?: string;
        redirect?: string;
      };
      if (!r.ok) {
        setError(data.error ?? "verify_failed");
        return;
      }
      window.location.replace(data.redirect ?? `/${locale}`);
    } catch {
      setError("network");
    } finally {
      setBusy(false);
    }
  }

  function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || phone.trim().length < 6) return;
    void sendCode();
  }

  function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || code.trim().length !== 6) return;
    void verifyCode();
  }

  const errorMessage = mapError(error, mode, alternateLabel, alternateHref);

  return (
    <div className="space-y-3">
      {step === "phone" ? (
        <form onSubmit={handlePhoneSubmit} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Telefon numarası
            </span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="+90 532 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
              className="w-full px-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-60 transition"
            />
            <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 pl-1">
              Ülke kodu dahil (+90, +31, +49, +32)
            </span>
          </label>

          {errorMessage}

          <button
            type="submit"
            disabled={busy || phone.trim().length < 6}
            className="flex items-center justify-between gap-3 w-full px-5 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/60 disabled:cursor-not-allowed text-white font-semibold shadow-lg active:scale-[0.98] transition"
          >
            <span className="flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Kod gönder ve giriş yap" : "Kod gönder ve üye ol"}
            </span>
            <ArrowRight className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </form>
      ) : (
        <form onSubmit={handleCodeSubmit} className="space-y-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            <span className="font-medium text-slate-900 dark:text-white">{phone}</span>{" "}
            numarasına WhatsApp ile 6 haneli kod gönderildi. 5 dakika içinde gir.
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Doğrulama kodu
            </span>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              placeholder="······"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={busy}
              className="w-full px-4 py-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-center text-2xl tracking-[0.5em] font-mono placeholder:text-slate-300 dark:placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-60 transition"
            />
          </label>

          {errorMessage}

          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="flex items-center justify-between gap-3 w-full px-5 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/60 disabled:cursor-not-allowed text-white font-semibold shadow-lg active:scale-[0.98] transition"
          >
            <span className="flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              Doğrula
            </span>
            <ArrowRight className="w-5 h-5" strokeWidth={2.4} />
          </button>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
                setCode("");
              }}
              disabled={busy}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.4} />
              Numarayı değiştir
            </button>
            <button
              type="button"
              onClick={() => void sendCode()}
              disabled={busy || cooldown > 0}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:text-slate-400 dark:disabled:text-slate-600 disabled:no-underline"
            >
              {cooldown > 0 ? `Yeniden gönder (${cooldown}sn)` : "Kodu yeniden gönder"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function mapError(
  error: string | null,
  mode: Mode,
  alternateLabel: string,
  alternateHref: string,
): React.ReactNode {
  if (!error) return null;
  let text: React.ReactNode = "Bir hata oluştu. Tekrar dene.";
  switch (error) {
    case "bad_phone":
      text = "Telefon numarası geçersiz. Ülke kodu dahil yaz (örn. +90 532...)";
      break;
    case "bad_code":
      text = "Kod 6 haneli olmalı.";
      break;
    case "rate_limited":
      text = "Çok fazla deneme. 5 dakika sonra tekrar dene.";
      break;
    case "wa_send_failed":
      text = "WhatsApp mesajı gönderilemedi. Tekrar dene.";
      break;
    case "no_account":
      text = (
        <span>
          Bu numara kayıtlı değil.{" "}
          <a
            href={alternateHref}
            className="font-semibold text-rose-700 dark:text-rose-300 underline"
          >
            {alternateLabel}
          </a>
        </span>
      );
      break;
    case "already_exists":
      text = (
        <span>
          Bu numara zaten kayıtlı.{" "}
          <a
            href={alternateHref}
            className="font-semibold text-rose-700 dark:text-rose-300 underline"
          >
            {alternateLabel}
          </a>
        </span>
      );
      break;
    case "invalid_code":
      text = "Kod hatalı. Tekrar dene.";
      break;
    case "expired":
      text = "Kod süresi doldu. Yeniden kod iste.";
      break;
    case "not_found":
      text = "Kod bulunamadı. Yeniden kod iste.";
      break;
    case "too_many_attempts":
      text = "Çok fazla yanlış deneme. 5 dakika sonra tekrar dene.";
      break;
    case "tenant_missing":
      text = "Tenant bulunamadı. Sayfayı yenile.";
      break;
    case "network":
      text = "Bağlantı hatası. İnternet kontrolü yap.";
      break;
    case "internal":
    case "send_failed":
    case "verify_failed":
      text =
        mode === "login"
          ? "Giriş başarısız. Tekrar dene."
          : "Kayıt başarısız. Tekrar dene.";
      break;
  }
  return (
    <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
      {text}
    </div>
  );
}
