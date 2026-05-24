"use client";

import type { OnboardingStepContext } from "@/platform/onboarding/engine";

const TIPS = [
  { icon: "✅", text: "Sol menüden tüm özelliklere ulaş" },
  { icon: "💡", text: "\"Sana özel 3 öneri\" widget'ı her gün yeni öneri sunar" },
  { icon: "🤖", text: "UPU AI Eleman widget'ı (sağ alt) WA komutlarıyla raporlama yapar" },
  { icon: "📊", text: "Bayi performans skorları otomatik hesaplanır (haftalık)" },
  { icon: "⚙️", text: "Tüm ayarlar → /tr/bayi-ayarlar" },
];

export function Step5Complete(ctx: OnboardingStepContext) {
  return (
    <div className="px-4 sm:px-6 py-6">
      <div className="text-center mb-5">
        <div className="text-6xl mb-3">🚀</div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
          Hazırsın!
        </h2>
        <p className="text-sm text-slate-500">
          UPU Bayi seninle. İşte hatırlaman gereken 5 ipucu:
        </p>
      </div>

      <ul className="space-y-2.5 mb-6 max-w-md mx-auto">
        {TIPS.map((t, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
            <span className="text-lg shrink-0">{t.icon}</span>
            <span className="text-sm text-slate-700 dark:text-slate-200 leading-snug">{t.text}</span>
          </li>
        ))}
      </ul>

      <button onClick={() => void ctx.complete()}
        className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 text-base font-semibold">
        Panele git →
      </button>
    </div>
  );
}
