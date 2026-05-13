"use client";

/**
 * KvkkConsentModal — Faz 7.0.
 *
 * Panel mount'unda /api/profile/kvkk-status.needsConsent=true ise gösterilir.
 * "Daha sonra" tıklanırsa onDefer çağrılır (parent localStorage flag set
 * eder, modal aynı gün tekrar açılmaz). "Okudum, onaylıyorum" → POST
 * /api/profile/kvkk-accept → onAccepted.
 */
import { useEffect, useState } from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";

interface KvkkConsentModalProps {
  onAccepted: () => void;
  onDefer: () => void;
}

export function KvkkConsentModal({ onAccepted, onDefer }: KvkkConsentModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Escape kapatır (defer davranışı), body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDefer();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onDefer]);

  async function accept() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/profile/kvkk-accept", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok) {
        onAccepted();
      } else {
        setErrorMsg("Kaydedilemedi. Tekrar dene.");
      }
    } catch {
      setErrorMsg("Bağlantı hatası. Tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onDefer}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kvkk-modal-title"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" strokeWidth={2.2} />
          </div>
          <h2 id="kvkk-modal-title" className="font-semibold text-slate-900 dark:text-white">
            KVKK Aydınlatma
          </h2>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          UPU Emlak&apos;ı kullanırken kişisel verilerinizin işlenmesi konusunda sizi bilgilendiren KVKK aydınlatma metnimizi onaylamanız gerekmektedir.
        </p>

        <a
          href="/tr/aydinlatma-metni"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          <span>Aydınlatma metnini oku</span>
          <ExternalLink className="w-4 h-4" strokeWidth={2.2} />
        </a>

        {errorMsg && (
          <p className="text-sm text-rose-600 dark:text-rose-400">{errorMsg}</p>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void accept()}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold active:scale-[0.98] transition"
          >
            {loading ? "Onaylanıyor..." : "Okudum, onaylıyorum"}
          </button>
          <button
            type="button"
            onClick={onDefer}
            className="w-full py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            Daha sonra
          </button>
        </div>
      </div>
    </div>
  );
}
