"use client";

import { useState } from "react";
import type { OnboardingStepContext } from "@/platform/onboarding/engine";

const SECTORS = [
  { id: "tekstil", label: "Tekstil" },
  { id: "gida", label: "Gıda" },
  { id: "kozmetik", label: "Kozmetik" },
  { id: "insaat", label: "İnşaat malzemeleri" },
  { id: "elektronik", label: "Elektronik" },
  { id: "diger", label: "Diğer" },
];

const DEALER_RANGES = [
  { id: "1-5", label: "1-5 bayi" },
  { id: "6-20", label: "6-20 bayi" },
  { id: "21-50", label: "21-50 bayi" },
  { id: "50+", label: "50+ bayi" },
];

export function Step2Profile(ctx: OnboardingStepContext) {
  const initialFirma = (ctx.state.firmaUnvani as string) || (ctx.state.displayName as string) || "";
  const [firma, setFirma] = useState(initialFirma);
  const [sector, setSector] = useState<string>((ctx.state.sector as string) || "");
  const [range, setRange] = useState<string>((ctx.state.dealer_range as string) || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/bayi-onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          firma_unvani: firma,
          sector,
          dealer_range: range,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Kayıt başarısız.");
        return;
      }
      ctx.setState({ firmaUnvani: firma, sector, dealer_range: range });
      await ctx.next();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
        Profilini tamamla
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        2 bilgi: hangi sektör + kaç bayin var.
      </p>

      <div className="space-y-4">
        <Field label="Firma adı">
          <input value={firma} onChange={e => setFirma(e.target.value)}
            placeholder="Firma unvanı"
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
        </Field>

        <Field label="Sektör">
          <div className="grid grid-cols-2 gap-2">
            {SECTORS.map(s => (
              <button key={s.id} type="button" onClick={() => setSector(s.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium text-left transition ${sector === s.id ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Tahmini bayi sayısı">
          <div className="grid grid-cols-2 gap-2">
            {DEALER_RANGES.map(r => (
              <button key={r.id} type="button" onClick={() => setRange(r.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium text-left transition ${range === r.id ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-100" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {error && <div className="text-xs text-rose-600 mt-3">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-2 mt-6">
        <button onClick={() => ctx.back()}
          className="rounded-md border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          ← Geri
        </button>
        <button onClick={() => void submit()} disabled={saving}
          className="flex-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2 text-sm font-semibold">
          {saving ? "Kaydediliyor…" : "Devam →"}
        </button>
        <button onClick={() => void ctx.skip()}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 hover:underline">
          Sonra yapayım
        </button>
      </div>
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
