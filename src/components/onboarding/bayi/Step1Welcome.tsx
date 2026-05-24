"use client";

import type { OnboardingStepContext } from "@/platform/onboarding/engine";

export function Step1Welcome(ctx: OnboardingStepContext) {
  const displayName = (ctx.state.displayName as string) || "";
  const first = displayName.split(" ")[0] || "Hoş geldin";

  return (
    <div className="px-4 sm:px-6 py-6 text-center">
      <div className="text-6xl mb-3">🎯</div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Hoşgeldin {first}!
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-5">
        UPU Bayi ile satış destek ekibin yanında.
      </p>

      <ul className="text-left text-sm space-y-2.5 mb-6 max-w-md mx-auto">
        <FeatureLine icon="📊" text="Bayilerini tek panelden yönet, performansını takip et" />
        <FeatureLine icon="📨" text="Otomatik kampanya ve drip mesajlarla satışını arttır" />
        <FeatureLine icon="🏪" text="Online vitrin kur, son müşteriden bayine lead yönlendir" />
      </ul>

      <button
        onClick={() => void ctx.next()}
        className="w-full sm:w-auto rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 text-sm font-semibold"
      >
        Hadi başlayalım →
      </button>
    </div>
  );
}

function FeatureLine({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
      <span className="text-xl shrink-0">{icon}</span>
      <span className="text-slate-700 dark:text-slate-200 leading-snug">{text}</span>
    </li>
  );
}
