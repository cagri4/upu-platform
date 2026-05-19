"use client";

/**
 * 403 Forbidden — rol bazlı erişim engellemesi UI.
 *
 * Sayfa/layout client-side rol check'in olumsuz dönmesi durumunda render
 * edilir. Defense-in-depth — server-side endpoint guard'ları ayrı.
 */

import { ShieldX } from "lucide-react";

interface ForbiddenProps {
  /** Kısa başlık, varsayılan "Yetkiniz yok". */
  title?: string;
  /** Ek bilgi mesajı (örn: hangi rol gerekli). */
  message?: string;
  /** Geri / panele dön linki, default /tr/bayi-panel. */
  backHref?: string;
  backLabel?: string;
}

export function Forbidden({
  title = "Yetkiniz yok",
  message = "Bu sayfaya erişim yetkiniz bulunmuyor. Şirket yöneticinizden yetki talep edin.",
  backHref = "/tr/bayi-panel",
  backLabel = "🏠 Panele Dön",
}: ForbiddenProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center mb-4">
          <ShieldX className="w-8 h-8 text-rose-600 dark:text-rose-400" strokeWidth={2} />
        </div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">{message}</p>
        <a
          href={backHref}
          className="inline-flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          {backLabel}
        </a>
      </div>
    </div>
  );
}
