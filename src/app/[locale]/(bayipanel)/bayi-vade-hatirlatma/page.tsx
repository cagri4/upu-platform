"use client";

/**
 * Vade Hatırlatma — Dalga 3 multi-row tracking sayfası iskelet.
 *
 * Şu an: placeholder. Dalga 3'te bayi_tracking_rules tablosu + CRUD eklenince
 * gerçek liste + + Yeni Kural modal + Durdur/Düzenle/Sil aksiyonları gelecek.
 *
 * Mevcut akış: WA'da `vade-hatirlatma` komutu kullanıcıya sabah özet gönderir
 * (otomatik T-X yok, sadece manuel hatırlatma). Bu sayfa o davranışı görsel
 * olarak yönetilebilir hale getirecek.
 */

import { useSearchParams } from "next/navigation";

export default function VadeHatirlatmaPage() {
  const params = useSearchParams();
  const token = params.get("t") || params.get("token") || "";

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">⏰ Vade Hatırlatma</h1>
          <button
            disabled
            className="inline-flex items-center gap-1 bg-slate-300 text-white text-sm font-semibold px-3 py-2 rounded-lg cursor-not-allowed"
          >
            <span>+</span> Yeni Kural
          </button>
        </div>
        <p className="text-xs text-slate-500">Vadesi yaklaşan bayilerinize otomatik hatırlatma kuralları yönetin.</p>
      </div>

      <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-6">
        <div className="text-3xl mb-3">🛠</div>
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Yakında</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
          Multi-bayi vade hatırlatma kuralları yakında. Şimdilik WhatsApp&apos;ta
          <span className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded mx-1 text-xs">vade-hatirlatma</span>
          komutu ile manuel olarak vadesi yaklaşan bayileri sorgulayabilirsiniz.
        </p>
        <div className="text-xs text-slate-500">
          <strong>Planlanan özellikler:</strong>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>Bayi-bazlı kural (her bayi için farklı vade gün + mesaj)</li>
            <li>Otomatik T-7 / T-3 / T-0 hatırlatma</li>
            <li>Kullanıcı onayı sonrası bayiye gönderim</li>
          </ul>
        </div>
        {token && (
          <a
            href={`https://wa.me/31644967207?text=${encodeURIComponent("vade-hatirlatma")}`}
            className="inline-block mt-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            💬 WhatsApp&apos;ta Sorgula
          </a>
        )}
      </div>
    </div>
  );
}
