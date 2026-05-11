"use client";

export default function MarketTedarikcilerPage() {
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Tedarikçiler</h1>
        <p className="text-amber-100 text-sm mt-2">Tedarikçi listesi ve iletişim bilgileri.</p>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center shadow-sm">
        <div className="text-4xl mb-3">🚚</div>
        <p className="font-semibold text-slate-900 mb-2">Yakında</p>
        <p className="text-sm text-slate-600 mb-3">
          Tedarikçi listesi ve sipariş geçmişi web panel üzerinden burada gösterilecek.
        </p>
        <p className="text-sm text-slate-500">
          Şimdilik WhatsApp&apos;tan{" "}
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">tedarikciler</span>
          {" "}veya{" "}
          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">tedarikciekle</span>
          {" "}komutlarını kullanabilirsiniz.
        </p>
      </div>
    </div>
  );
}
