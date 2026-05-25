"use client";

import { Info, Globe, Mail } from "lucide-react";
import { HeroBanner, InfoChip } from "@/components/banking";

export default function MarketHakkindaPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Info}
        title="UPUDev Hakkında"
        subtitle="Türk diaspora KOBİ'leri için WhatsApp + AI destekli SaaS platformu."
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/70 dark:border-slate-800 shadow-sm space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        <p>
          <strong>UPU</strong>, Hollanda ve Avrupa&apos;daki Türk küçük işletmelerinin (market, restoran, emlak, dağıtım, otel) günlük operasyonlarını WhatsApp + yapay zeka ile yönetmesini sağlayan bir platformdur.
        </p>
        <p>
          <strong>Felsefemiz:</strong> Mevcut araçlarınıza (POS, muhasebe yazılımı, kasa terminali) dokunmayız. Üstüne <em>akıllı bir katman</em> koyarız. Sizin yerinize hatırlar, raporlar, mesaj taslağı hazırlar; siz onaylarsınız.
        </p>
        <p>
          <strong>Pazar:</strong> NL Türk diasporası özelinde sıcak Türk dilinde, KvK/BTW uyumlu, EUR para biriminde çalışırız. NL, BE, DE, TR pazarına yayılma planlanıyor.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">İletişim</p>
        <InfoChip Icon={Globe} text="upudev.nl" href="https://upudev.nl" />
        <InfoChip Icon={Mail} text="info@upudev.nl" href="mailto:info@upudev.nl" />
      </div>
    </div>
  );
}
