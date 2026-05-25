"use client";

import { MessageSquare, MessageCircle } from "lucide-react";
import { HeroBanner, InfoChip } from "@/components/banking";

export default function OtelMesajlarPage() {
  return (
    <div className="space-y-5">
      <HeroBanner
        title="Mesaj Taslakları"
        subtitle="Sürekli misafirleriniz için doğum günü, sezon kampanyası ve yeniden çağrı taslakları — onayınızla gönderilir, asla otomatik atılmaz."
        Icon={MessageSquare}
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 p-8 text-center shadow-sm">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
          <MessageSquare className="w-8 h-8" strokeWidth={1.8} />
        </div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Yakında</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          Loyalty engine — pazarlama opt-in vermiş misafirler için kişiselleştirilmiş taslaklar. AI üretir, siz onaylarsınız.
        </p>
      </div>

      <InfoChip
        Icon={MessageCircle}
        text="Şimdilik 'yanitla' komutuyla gelen misafir mesajlarına WhatsApp üzerinden tek-tek yanıt verebilirsiniz."
        onClick={() => { /* sadece bilgi */ }}
      />
    </div>
  );
}
