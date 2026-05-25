"use client";

import { Truck, Sparkles, MessageCircle } from "lucide-react";
import { HeroBanner, InfoChip } from "@/components/banking";

const WA_BASE = "https://wa.me/31644967207?text=";

export default function MarketTedarikcilerPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Truck}
        title="Tedarikçiler"
        subtitle="Tedarikçi listesi ve iletişim bilgileri."
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/70 dark:border-slate-800 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-7 h-7" strokeWidth={2.2} />
        </div>
        <p className="font-semibold text-slate-900 dark:text-white mb-1.5">Yakında</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Tedarikçi listesi ve sipariş geçmişi web panel üzerinden burada gösterilecek.
        </p>
      </div>

      <div className="space-y-2">
        <InfoChip Icon={MessageCircle} text="WhatsApp'ta 'tedarikciler' yaz" href={`${WA_BASE}tedarikciler`} />
        <InfoChip Icon={MessageCircle} text="WhatsApp'ta 'tedarikciekle' yaz" href={`${WA_BASE}tedarikciekle`} />
      </div>
    </div>
  );
}
