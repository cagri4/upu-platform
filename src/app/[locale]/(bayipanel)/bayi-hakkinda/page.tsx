"use client";

/**
 * UPUDev Hakkında — bayi tenant kopyası (emlak (panel)/hakkinda eşi).
 *
 * AdminLayout zaten "WhatsApp'a Dön" sağlıyor → ReturnButtons gerekmez.
 */

export default function BayiHakkindaPage() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-stone-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">UPUDev Hakkında</h1>
        <p className="text-stone-200 text-sm mt-2 leading-relaxed">
          AI destekli sektör asistanları geliştiren bir teknoloji firması.
        </p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3 text-sm text-slate-700 leading-relaxed">
        <p>
          UPUDev, küçük ve orta ölçekli işletmelerin tekrar eden operasyonlarını yapay zeka ile otomatikleştirmek üzerine kurulu bir teknoloji firmasıdır. Sektörel asistanlarımız (emlak, bayi, otel, market, restoran, site yönetimi) WhatsApp üzerinden çalışır — ekstra uygulama indirmenize gerek yoktur.
        </p>
        <p>
          Vizyonumuz: her sektör için 7/24 çalışan, sade ama güçlü bir AI çalışma arkadaşı. Ödediğiniz aylık ücret bir personelin maaşının çok altındadır; karşılığında saatlerinizi geri kazanırsınız.
        </p>
        <p className="text-slate-500 text-xs pt-3 border-t border-slate-100">
          İletişim: <a href="mailto:hello@upudev.nl" className="underline">hello@upudev.nl</a>
        </p>
      </div>
    </div>
  );
}
