"use client";

/**
 * Cirolarım (Raporlar) — placeholder.
 *
 * WA'da `rapor` komutu mevcut sektörel rapor üretir. İlerde grafik + KPI
 * dashboard ile zenginleşecek.
 */

import { useSearchParams } from "next/navigation";

export default function CirolarimPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">📊 Cirolarım</h1>
        <p className="text-xs text-slate-500 mt-0.5">Aylık ciro, sipariş trend, en çok satan ürünler.</p>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-6">
        <div className="text-3xl mb-3">📈</div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Yakında</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Ciro grafikleri, satış trendleri ve detaylı raporlar yakında. Şimdilik WhatsApp&apos;ta
          <span className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded mx-1 text-xs">rapor</span>
          komutu ile sektörel özet rapor alabilirsiniz.
        </p>
        {token && (
          <a
            href={`https://wa.me/31644967207?text=${encodeURIComponent("rapor")}`}
            className="inline-block mt-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            💬 WhatsApp&apos;ta Rapor Al
          </a>
        )}
      </div>
    </div>
  );
}
