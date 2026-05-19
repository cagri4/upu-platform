"use client";

/**
 * /tr/kullanici-davet/[token] — Kullanıcı davet kabul.
 *
 * Admin tarafından paylaşılan link tıklandığında: token validate → davet
 * detay (rol + inviter firma adı) → "Devam Et" → POST accept → cookie
 * session attach + bayi-panel'e role bazlı yönlendirme.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

interface ValidateResp {
  ok: true;
  name: string;
  phone: string;
  role: string;
  role_label: string;
  inviterName: string;
  expiresAt: string;
}

export default function KullaniciDavetAcceptPage() {
  const params = useParams();
  const token = String(params.token || "");

  const [state, setState] = useState<"loading" | "ready" | "error" | "submitting" | "done">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<ValidateResp | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("Geçersiz davet linki.");
      return;
    }
    fetch(`/api/kullanici-davet/validate?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Davet doğrulanamadı.");
        setData(d as ValidateResp);
        setState("ready");
      })
      .catch((e) => {
        setError(e.message || "Bağlantı hatası.");
        setState("error");
      });
  }, [token]);

  async function handleAccept() {
    setState("submitting");
    setError("");
    try {
      const r = await fetch("/api/kullanici-davet/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Davet kabul edilemedi.");
        setState("error");
        return;
      }
      setState("done");
      window.location.href = d.redirect || "/tr/bayi-panel";
    } catch {
      setError("Bağlantı hatası.");
      setState("error");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-md p-6 space-y-4">
        {state === "loading" && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Davet doğrulanıyor…</p>
          </div>
        )}

        {state === "error" && !data && (
          <div className="text-center py-6">
            <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" strokeWidth={1.8} />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Davet Geçersiz</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
          </div>
        )}

        {data && (state === "ready" || state === "submitting") && (
          <>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">Hoş geldiniz!</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {data.inviterName} sizi <span className="font-semibold">{data.role_label}</span> rolü ile davet ediyor
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 text-sm">
              <Row label="İsim" value={data.name} />
              <Row label="Telefon" value={data.phone} />
              <Row label="Rol" value={data.role_label} />
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-lg p-3 text-sm text-rose-700 dark:text-rose-300">
                ⚠️ {error}
              </div>
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              &quot;Devam Et&quot; butonuna tıkladığınızda hesabınız aktifleşir ve role uygun panele yönlendirilirsiniz.
            </p>

            <button
              type="button"
              onClick={handleAccept}
              disabled={state === "submitting"}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              {state === "submitting" && <Loader2 className="w-4 h-4 animate-spin" />}
              {state === "submitting" ? "Hesap oluşturuluyor…" : "Devam Et"}
              {state !== "submitting" && <ArrowRight className="w-4 h-4" />}
            </button>
          </>
        )}

        {state === "done" && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Panele yönlendiriliyorsunuz…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-white text-right break-words">{value}</span>
    </div>
  );
}
