"use client";

/**
 * StepUpModal — Faz 6.6 WA OTP step-up doğrulama modal'ı.
 *
 * Akış: intro → "Kodu Gönder" → /api/auth/step-up/start → code stage →
 * 6 hane gir → /api/auth/step-up/verify → cookie set → onVerified callback.
 * Parent component sensitive action'ı yeniden tetiklemekten sorumlu.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, X, Loader2 } from "lucide-react";

interface StepUpModalProps {
  /** Modal kapatıldığında çağrılır (X, Escape, backdrop). */
  onCancel: () => void;
  /** Verify başarılı olunca çağrılır — parent action'a devam eder. */
  onVerified: () => void;
}

type Stage = "intro" | "sending" | "code" | "verifying";

export function StepUpModal({ onCancel, onVerified }: StepUpModalProps) {
  const [stage, setStage] = useState<Stage>("intro");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Escape ile kapatma + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onCancel]);

  async function startChallenge() {
    setStage("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/step-up/start", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(mapStartError(data.error));
        setStage("intro");
        return;
      }
      setChallengeId(data.challengeId);
      setStage("code");
    } catch {
      setErrorMsg("Bağlantı hatası. Tekrar dene.");
      setStage("intro");
    }
  }

  async function verify() {
    if (code.length !== 6 || !challengeId) return;
    setStage("verifying");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/step-up/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(mapVerifyError(data.error));
        setStage("code");
        return;
      }
      onVerified();
    } catch {
      setErrorMsg("Bağlantı hatası. Tekrar dene.");
      setStage("code");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-up-title"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" strokeWidth={2.2} />
          </div>
          <h2 id="step-up-title" className="font-semibold text-slate-900 dark:text-white flex-1">
            Güvenlik Doğrulaması
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Kapat"
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 transition"
          >
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        {stage === "intro" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Bu hassas işlem için WhatsApp numarana 6 haneli güvenlik kodu göndereceğiz.
            </p>
            {errorMsg && (
              <p className="text-sm text-rose-600 dark:text-rose-400">{errorMsg}</p>
            )}
            <button
              type="button"
              onClick={() => void startChallenge()}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold active:scale-[0.98] transition"
            >
              Kodu Gönder
            </button>
          </div>
        )}

        {stage === "sending" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Kod gönderiliyor...</p>
          </div>
        )}

        {stage === "code" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              WhatsApp&apos;a gönderilen 6 haneli kodu gir.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
              placeholder="••••••"
              autoFocus
            />
            {errorMsg && (
              <p className="text-sm text-rose-600 dark:text-rose-400">{errorMsg}</p>
            )}
            <button
              type="button"
              onClick={() => void verify()}
              disabled={code.length !== 6}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold active:scale-[0.98] transition"
            >
              Doğrula
            </button>
          </div>
        )}

        {stage === "verifying" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Doğrulanıyor...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function mapStartError(err: string | undefined): string {
  switch (err) {
    case "rate_limited":
      return "Çok fazla deneme. 1 saat sonra tekrar dene.";
    case "wa_phone_missing":
      return "WhatsApp numaran bulunamadı.";
    case "wa_send_failed":
      return "Mesaj gönderilemedi. Tekrar dene.";
    default:
      return "Kod gönderilemedi. Tekrar dene.";
  }
}

function mapVerifyError(err: string | undefined): string {
  switch (err) {
    case "invalid_code":
      return "Kod yanlış, tekrar dene.";
    case "expired":
      return "Kodun süresi doldu. Yeni kod iste.";
    case "too_many_attempts":
      return "Çok fazla yanlış deneme. Yeni kod iste.";
    case "not_found":
      return "Kod bulunamadı. Yeni kod iste.";
    case "already_used":
      return "Kod zaten kullanıldı. Yeni kod iste.";
    case "bad_request":
      return "Geçersiz kod.";
    default:
      return "Doğrulama başarısız. Tekrar dene.";
  }
}
