"use client";

export default function TakvimPage() {
  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-sky-700 to-cyan-900 text-white rounded-2xl p-5">
        <div className="text-3xl mb-1">📅</div>
        <h1 className="text-xl font-bold">Takvim</h1>
        <p className="text-sky-200 text-sm mt-1">TODO listesi, randevu ve WhatsApp hatırlatmaları</p>
      </div>

      {/* Disabled action — Faz 3 wire-up bekliyor */}
      <button
        disabled
        className="w-full bg-slate-300 text-slate-500 text-center font-semibold py-4 rounded-2xl cursor-not-allowed"
        title="Yakında"
      >
        ➕ Görev Ekle (Yakında)
      </button>

      <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
        <div className="text-5xl mb-3">📅</div>
        <p className="font-semibold text-slate-900 mb-1">Yakında</p>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          TODO listesi, randevu takvimi ve WhatsApp hatırlatma bildirimleri tek ekranda — Faz 3&apos;te aktif olacak.
        </p>
      </div>
    </div>
  );
}
