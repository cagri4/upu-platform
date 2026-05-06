"use client";

import React from "react";

/**
 * Form/sayfa altında 2 buton: Panele Dön + WhatsApp'a Dön.
 *
 * WhatsApp WebView içinden açılan sayfalarda, intent:// veya wa.me
 * scheme'i "başka uygulama açılıyor" uyarısı gösteriyor. Bu sayfalar
 * her zaman WhatsApp gateway'inden geldiği için (kullanıcı WA chat'te
 * bot mesajındaki linke tıklıyor) "her zaman WebView içinde" kabul
 * edilir — tıklandığında history.back() / window.close() ile aynı
 * sekmede WA chat'e döner. Android intent fallback kaldırıldı.
 *
 * Edge-case: kullanıcı linki kopyalayıp Chrome'a yapıştırırsa back-stack
 * boş olur, fallback window.close() denenir; o da fail ederse en son
 * çare wa.me redirect.
 */
export function ReturnButtons({
  token,
  botPhone,
  onWaReturn,
  showPanel = true,
}: {
  token: string | null;
  botPhone: string;
  /** İsteğe bağlı — WA'a dönmeden önce side-effect (örn. /api/finish call). */
  onWaReturn?: () => Promise<void> | void;
  /** Panel sayfasında ikinci buton gereksiz — false yap. */
  showPanel?: boolean;
}) {
  async function handleWaClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (onWaReturn) {
      try { await onWaReturn(); } catch { /* swallow */ }
    }
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
        return;
      }
      if (typeof window !== "undefined") {
        window.close();
        // close başarısız olursa en son çare:
        setTimeout(() => {
          if (!document.hidden) window.location.href = `https://wa.me/${botPhone}`;
        }, 200);
      }
    } catch {
      window.location.href = `https://wa.me/${botPhone}`;
    }
  }

  const panelHref = `/tr/panel${token ? `?t=${encodeURIComponent(token)}` : ""}`;

  return (
    <div className="space-y-2 mt-6">
      {showPanel && (
        <a
          href={panelHref}
          className="block w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-4 rounded-xl font-semibold text-base shadow-lg text-center active:scale-95 transition"
        >
          🖥 Panele Dön
        </a>
      )}
      <a
        href={`https://wa.me/${botPhone}`}
        onClick={handleWaClick}
        className="block w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-4 rounded-xl font-semibold text-base shadow-lg text-center active:scale-95 transition"
      >
        💬 WhatsApp&apos;a Dön
      </a>
    </div>
  );
}
