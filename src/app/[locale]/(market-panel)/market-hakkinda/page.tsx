"use client";

export default function MarketHakkindaPage() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">UPUDev Hakkında</h1>
        <p className="text-amber-100 text-sm mt-2">Türk diaspora KOBİ&apos;leri için WhatsApp + AI destekli SaaS platformu.</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm space-y-4 text-sm text-slate-700 leading-relaxed">
        <p>
          <strong>UPU</strong>, Hollanda ve Avrupa&apos;daki Türk küçük işletmelerinin (market, restoran, emlak, dağıtım, otel) günlük operasyonlarını WhatsApp + yapay zeka ile yönetmesini sağlayan bir platformdur.
        </p>
        <p>
          <strong>Felsefemiz:</strong> Mevcut araçlarınıza (POS, muhasebe yazılımı, kasa terminali) dokunmayız. Üstüne <em>akıllı bir katman</em> koyarız. Sizin yerinize hatırlar, raporlar, mesaj taslağı hazırlar; siz onaylarsınız.
        </p>
        <p>
          <strong>Pazar:</strong> NL Türk diasporası özelinde sıcak Türk dilinde, KvK/BTW uyumlu, EUR para biriminde çalışırız. NL, BE, DE, TR pazarına yayılma planlanıyor.
        </p>
        <div className="pt-3 border-t border-slate-100">
          <p className="font-semibold text-slate-900 mb-1">İletişim</p>
          <p className="text-slate-600">
            Web: <span className="font-mono">upudev.nl</span><br />
            E-posta: <span className="font-mono">info@upudev.nl</span>
          </p>
        </div>
      </div>
    </div>
  );
}
