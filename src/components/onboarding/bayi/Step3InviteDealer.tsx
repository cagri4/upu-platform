"use client";

import { useState } from "react";
import type { OnboardingStepContext } from "@/platform/onboarding/engine";

export function Step3InviteDealer(ctx: OnboardingStepContext) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState<{ accept_url: string; share_phone: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendInvite() {
    setError(null);
    if (!phone.match(/^\+?\d{8,15}$/)) {
      setError("Geçerli bir telefon (örn +905551234567) girin.");
      return;
    }
    setSending(true);
    try {
      const r = await fetch("/api/bayi-onboarding/invite-dealer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ phone, name }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Davet başarısız.");
        return;
      }
      setSentInfo({ accept_url: d.accept_url, share_phone: d.share_phone });
    } finally {
      setSending(false);
    }
  }

  function shareWA() {
    if (!sentInfo) return;
    const text = `Selam${name ? ` ${name}` : ""}! Bayilik sistemime davetlisin: ${sentInfo.accept_url}`;
    window.open(`https://wa.me/${sentInfo.share_phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
        İlk bayini davet et
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        Bir bayinin WhatsApp numarasını gir, davet linkini sen paylaş.
      </p>

      {!sentInfo ? (
        <>
          <div className="space-y-3">
            <Field label="WhatsApp numarası">
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+905551234567 veya +31644967207"
                className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
            </Field>
            <Field label="İsim (opsiyonel)">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Ahmet Boyacı"
                className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
            </Field>
          </div>
          {error && <div className="text-xs text-rose-600 mt-3">{error}</div>}

          <div className="flex flex-col sm:flex-row gap-2 mt-5">
            <button onClick={() => ctx.back()}
              className="rounded-md border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              ← Geri
            </button>
            <button onClick={() => void sendInvite()} disabled={sending || !phone}
              className="flex-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2 text-sm font-semibold">
              {sending ? "Hazırlanıyor…" : "Davet Linki Hazırla"}
            </button>
            <button onClick={() => void ctx.skip()}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 hover:underline">
              Bayim henüz yok →
            </button>
          </div>
        </>
      ) : (
        <div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-3">
            <div className="text-sm font-semibold text-emerald-900">✓ Davet linki hazır</div>
            <div className="text-[11px] font-mono text-emerald-800 mt-1 break-all">{sentInfo.accept_url}</div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Linki paylaş — bayi tıkladığında kayıt akışına geçer.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={shareWA}
              className="flex-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold">
              📱 WhatsApp ile paylaş
            </button>
            <button onClick={() => void ctx.next()}
              className="flex-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold">
              Devam →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
