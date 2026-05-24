"use client";

import { useState } from "react";
import type { OnboardingStepContext } from "@/platform/onboarding/engine";

export function Step4Vitrine(ctx: OnboardingStepContext) {
  const initialSlug = ((ctx.state.displayName as string) || "bayi")
    .toLowerCase()
    .replace(/[ğ]/g, "g").replace(/[ü]/g, "u").replace(/[ş]/g, "s")
    .replace(/[ı]/g, "i").replace(/[ö]/g, "o").replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32);

  const [slug, setSlug] = useState(initialSlug);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    if (slug.length < 3) {
      setError("En az 3 karakter.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/bayi-vitrine/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          slug,
          title: (ctx.state.firmaUnvani as string) || (ctx.state.displayName as string) || "Mağaza",
          is_active: true,
          show_prices: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "Vitrin oluşturulamadı.");
        return;
      }
      ctx.setState({ vitrine_slug: d.vitrine?.slug || slug });
      await ctx.next();
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = slug ? `retailai.upudev.nl/tr/v/${slug}` : null;

  return (
    <div className="px-4 sm:px-6 py-6">
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
        Online vitrinini kur
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        Müşterilerin sana lead göndersin — 5 dakikada hazır, paylaşılabilir link, ücretsiz.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Vitrin adresi (slug)
          </span>
          <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="ornek-magaza"
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
        </label>

        {previewUrl && (
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 px-3 py-2">
            <div className="text-[10px] text-indigo-700 dark:text-indigo-300 mb-0.5">VİTRİN LİNKİN</div>
            <div className="text-sm font-mono text-indigo-900 dark:text-indigo-100 break-all">{previewUrl}</div>
          </div>
        )}
      </div>

      {error && <div className="text-xs text-rose-600 mt-3">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-2 mt-6">
        <button onClick={() => ctx.back()}
          className="rounded-md border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          ← Geri
        </button>
        <button onClick={() => void create()} disabled={saving || !slug}
          className="flex-1 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-4 py-2 text-sm font-semibold">
          {saving ? "Oluşturuluyor…" : "Vitrin Oluştur"}
        </button>
        <button onClick={() => void ctx.skip()}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline-offset-2 hover:underline">
          Vitrini sonra kurayım
        </button>
      </div>
    </div>
  );
}
