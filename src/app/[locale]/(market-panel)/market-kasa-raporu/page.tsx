"use client";

export default function MarketKasaRaporuPage() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Kasa Raporu</h1>
        <p className="text-amber-100 text-sm mt-2">Günlük, haftalık ve aylık satış özeti.</p>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow-sm">
        <div className="text-4xl mb-3">🧾</div>
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Yakında</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Detaylı kasa raporu, ürün sıralaması ve yoğun saat analizi web panelde burada görünecek.
        </p>
        <p className="text-sm text-slate-500">
          Şimdilik WhatsApp&apos;tan{" "}
          <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">kasarapor</span>
          ,{" "}
          <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">raporgunluk</span>
          {" "}veya{" "}
          <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">topsatan</span>
          {" "}komutlarını kullanabilirsiniz.
        </p>
      </div>
    </div>
  );
}
