"use client";

import { CalendarDays, MessageCircle } from "lucide-react";
import { HeroBanner, InfoChip } from "@/components/banking";

export default function OtelTakvimPage() {
  return (
    <div className="space-y-5">
      <HeroBanner
        title="Müsaitlik Takvimi"
        subtitle="Aylık takvim görünümünde tüm odalarınızın doluluğunu, blok-out günlerini ve gelecek rezervasyonları tek bakışta görebileceksiniz."
        Icon={CalendarDays}
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-8 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
          <CalendarDays className="w-8 h-8" strokeWidth={1.8} />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Yakında</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Aylık grid takvim — odalar satır, günler sütun. Rezervasyon balonlarına tıklayarak detay açılır.
        </p>
      </div>

      <InfoChip
        Icon={MessageCircle}
        text="Şimdilik musaitlik komutuyla WhatsApp'tan tarih bazlı boş oda sorgulayabilirsiniz."
        onClick={() => { /* sadece bilgi */ }}
      />
    </div>
  );
}
