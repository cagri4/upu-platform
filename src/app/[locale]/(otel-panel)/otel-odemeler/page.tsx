"use client";

export default function OtelOdemelerPage() {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
      <div className="text-5xl mb-3">💰</div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Ödemeler</h1>
      <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
        Açık ödemeler, kart bilgisi olmayan rezervasyonlar ve aylık tahsilat özeti burada listelenecek. Stripe / iyzico entegrasyonu ile online tahsilat MVP2&apos;de.
      </p>
      <p className="text-xs text-slate-500">
        Yakında — şimdilik rezervasyonların total_price alanını dashboard&apos;da görebilirsiniz.
      </p>
    </div>
  );
}
