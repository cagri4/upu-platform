"use client";

export default function MarketMusteriSadakatiPage() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Müşteri Sadakati</h1>
        <p className="text-amber-100 text-sm mt-2">Sadık müşteri panosu, vade defteri ve doğum günü hatırlatıcıları.</p>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow-sm">
        <div className="text-4xl mb-3">💛</div>
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Yakında</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Sadık müşterileriniz, vade defteri, doğum günü kutlamaları ve kampanya broadcast paneli yakında burada açılacak.
        </p>
        <p className="text-sm text-slate-500 italic">
          &ldquo;Sadık Müşterim&rdquo; modülü hazırlanıyor — vade defteri dijitalleşiyor, müşterileriniz sizi unutmayacak.
        </p>
      </div>
    </div>
  );
}
