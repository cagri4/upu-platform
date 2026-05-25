"use client";

import { ClipboardList, Sparkles, MessageCircle } from "lucide-react";
import { HeroBanner, InfoChip } from "@/components/banking";

const WA_BASE = "https://wa.me/31644967207?text=";

export default function MarketTedarikciSiparisleriPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={ClipboardList}
        title="Tedarikçi Siparişleri"
        subtitle="Açık siparişleriniz ve teslim alma takibi."
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/70 dark:border-slate-800 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
          <Sparkles className="w-7 h-7" strokeWidth={2.2} />
        </div>
        <p className="font-semibold text-slate-900 dark:text-white mb-1.5">Yakında</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Tedarikçi siparişleriniz, teslimat durumları ve geçmişi burada listelenecek.
        </p>
      </div>

      <div className="space-y-2">
        <InfoChip Icon={MessageCircle} text="WhatsApp'ta 'siparisler' yaz" href={`${WA_BASE}siparisler`} />
        <InfoChip Icon={MessageCircle} text="WhatsApp'ta 'siparisolustur' yaz" href={`${WA_BASE}siparisolustur`} />
        <InfoChip Icon={MessageCircle} text="WhatsApp'ta 'teslimal' yaz" href={`${WA_BASE}teslimal`} />
      </div>
    </div>
  );
}
