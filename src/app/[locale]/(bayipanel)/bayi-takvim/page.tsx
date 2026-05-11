"use client";

/**
 * Takvim — placeholder.
 *
 * İlerde sipariş teslim tarihi, vade tarihleri, kampanya başlangıç/bitişleri
 * tek takvim görünümünde toplanacak.
 */

export default function TakvimPage() {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">📅 Takvim</h1>
        <p className="text-xs text-slate-500 mt-0.5">Sipariş teslim tarihleri, vade ve kampanyalar.</p>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-6">
        <div className="text-3xl mb-3">📅</div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Yakında</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Sipariş, vade, kampanya ve önemli olayların tek takvim görünümü
          yakında.
        </p>
      </div>
    </div>
  );
}
