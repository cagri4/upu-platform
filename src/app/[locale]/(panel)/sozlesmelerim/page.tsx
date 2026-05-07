"use client";

export default function SozlesmelerimPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <div className="text-6xl mb-4">📋</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Sözleşmelerim</h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
          Yakında: Aktif sözleşmeleriniz, imza durumları ve PDF dokümanları tek listede.
        </p>
        <p className="text-xs text-slate-400 mt-4">
          Şu an WhatsApp&apos;tan <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">sozlesme</span> yazarak yeni sözleşme oluşturabilirsiniz.
        </p>
      </div>
    </div>
  );
}
