"use client";

import { Heart, Sparkles } from "lucide-react";
import { HeroBanner } from "@/components/banking";

export default function MarketMusteriSadakatiPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Heart}
        title="Müşteri Sadakati"
        subtitle="Sadık müşteri panosu, vade defteri ve doğum günü hatırlatıcıları."
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/70 dark:border-slate-800 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-7 h-7" strokeWidth={2.2} />
        </div>
        <p className="font-semibold text-slate-900 dark:text-white mb-1.5">Yakında</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-3">
          Sadık müşterileriniz, vade defteri, doğum günü kutlamaları ve kampanya broadcast paneli yakında burada açılacak.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic max-w-md mx-auto">
          &ldquo;Sadık Müşterim&rdquo; modülü hazırlanıyor — vade defteri dijitalleşiyor, müşterileriniz sizi unutmayacak.
        </p>
      </div>
    </div>
  );
}
