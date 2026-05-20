"use client";

/**
 * /tr/bayi-odeme — Online ödeme placeholder.
 *
 * Banka POS entegrasyonu henüz aktif değil. iframe slot gri kutu olarak
 * gösterilir + altta "Manuel Ödeme Kaydet" link → /tr/bayi-tahsilatlarim.
 */

import { CreditCard, AlertTriangle } from "lucide-react";
import { HeroBanner } from "@/components/banking";

export default function BayiOdemePage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner Icon={CreditCard} title="Online Ödeme" subtitle="Bankanızla güvenli ödeme yapın." />

      <div className="bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 p-4 rounded-r-xl">
        <div className="flex gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={2.2} />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold mb-1">🏦 Bankanızla entegrasyon devam ediyor</p>
            <p className="text-xs leading-relaxed">
              Şu anda manuel ödeme onayı aktif. Banka entegrasyonu tamamlandığında bu sayfa otomatik aktifleşecek.
            </p>
          </div>
        </div>
      </div>

      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl h-72 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <CreditCard className="w-10 h-10 text-slate-400 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-slate-500 dark:text-slate-400">Banka POS iframe burada görünecek</p>
          <p className="text-[11px] text-slate-400 mt-1">Entegrasyon hazır olduğunda otomatik aktif</p>
        </div>
      </div>

      <a
        href="/tr/bayi-tahsilatlarim"
        className="block w-full text-center bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-semibold"
      >
        💳 Manuel Ödeme Kaydet
      </a>

      <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
        Banka havalesi ile ödeme yaptıktan sonra dekontunuzu yükleyin, sistemimiz onaya gönderir.
      </p>
    </div>
  );
}
