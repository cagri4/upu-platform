"use client";

export default function OtelMesajlarPage() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm text-center">
      <div className="text-5xl mb-3">✉️</div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Mesaj Taslakları</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-md mx-auto">
        Sürekli müşterileriniz için doğum günü tebriği, sezon kampanyası, yeniden çağrı (10+ ay sessiz) gibi otomatik üretilen WhatsApp mesaj taslakları burada listelenecek — onayınızla gönderilir, asla otomatik atılmaz.
      </p>
      <p className="text-xs text-slate-500">
        MVP2 loyalty engine — pazarlama opt-in vermiş misafirler için.
      </p>
    </div>
  );
}
