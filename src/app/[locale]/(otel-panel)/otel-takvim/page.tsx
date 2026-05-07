"use client";

export default function OtelTakvimPage() {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
      <div className="text-5xl mb-3">🗓</div>
      <h1 className="text-xl font-bold text-slate-900 mb-2">Müsaitlik Takvimi</h1>
      <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
        Aylık takvim görünümünde tüm odalarınızın doluluğunu, blok-out günlerini ve gelecek rezervasyonları tek bakışta görüntüleyebileceksiniz. Yakında.
      </p>
      <p className="text-xs text-slate-500">
        Şimdilik <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">musaitlik</span> komutu ile WhatsApp&apos;tan tarih bazlı boş oda sorgulayabilirsiniz.
      </p>
    </div>
  );
}
