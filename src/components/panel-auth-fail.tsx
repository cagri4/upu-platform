"use client";

/**
 * Panel auth fail page — 4 tenant panel layout'tan paylaşılan error screen.
 *
 * Eski davranış: "WhatsApp'a dön" tek buton + "Panele Git" referansı (artık
 * o akış evergreen URL ile değiştirildi → metin obsolete). User stale cookie
 * ile stuck oluyordu, login flow yoktu.
 *
 * Yeni davranış:
 *   1. Primary — WA ile giriş (tenant prefix'li mesaj, bot otomatik akışa
 *      sokar — router'da "giriş yap" intent zaten mevcut)
 *   2. Secondary — /{locale}/giris login sayfası (tek buton hızlı yol)
 *   3. PWA tip — stale cookie'de PWA'yı silip yeniden yüklemek temiz başlatır
 */

import { useLocale } from "next-intl";
import { getTenantByKey } from "@/tenants/config";

interface PanelAuthFailProps {
  /** "emlak" | "bayi" | "market" | "otel" — layout group'una göre sabit. */
  tenantKey: string;
  /** API'den dönen mesaj (örn. "Oturum bulunamadı veya süresi dolmuş."). */
  message: string;
}

const BOT_PHONE = "31644967207";

export function PanelAuthFail({ tenantKey, message }: PanelAuthFailProps) {
  const locale = useLocale();
  const tenant = getTenantByKey(tenantKey);
  const prefix = (tenant?.saasType ?? tenantKey).toUpperCase();
  const waText = `${prefix}: Giriş yap`;
  const waUrl = `https://wa.me/${BOT_PHONE}?text=${encodeURIComponent(waText)}`;
  const loginUrl = `/${locale}/giris`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-sm border border-slate-200/70 dark:border-slate-800">
        <div className="text-4xl mb-3">⚠️</div>
        <h1 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
          Oturum bulunamadı
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-5">{message}</p>

        <div className="flex flex-col gap-2">
          <a
            href={waUrl}
            className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-lg font-semibold transition"
          >
            📱 WhatsApp ile Giriş
          </a>
          <a
            href={loginUrl}
            className="inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 px-5 py-2.5 rounded-lg font-medium text-sm transition"
          >
            Giriş Sayfası
          </a>
        </div>

        <p className="text-slate-500 dark:text-slate-400 text-xs mt-5 leading-relaxed">
          💡 PWA&apos;da takıldıysanız: uygulamayı silip yeniden yükleyerek temiz başlatabilirsiniz.
        </p>
      </div>
    </div>
  );
}
