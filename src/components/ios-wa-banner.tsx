"use client";

/**
 * iOS + WhatsApp in-app webview detect banner.
 *
 * Bot mesajındaki "Paneli Aç" linki iOS'ta WA in-app webview'de açılır;
 * orada "Ana Ekrana Ekle" YOK. PWA install için Safari'ye geçiş şart.
 * Bu component yalnız iOS + WhatsApp UA kombinasyonunda + standalone
 * değilse görünür. Dismiss sessionStorage'da hatırlanır (kullanıcı aynı
 * oturumda tekrar görmesin).
 */

import { useEffect, useState } from "react";

const DISMISS_KEY = "ios-wa-banner-dismissed";

export function IosWaBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isWa = /WhatsApp/i.test(ua);
    const isStandalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIos && isWa && !isStandalone) {
      try {
        if (sessionStorage.getItem(DISMISS_KEY) !== "1") setShow(true);
      } catch {
        setShow(true);
      }
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* silent */
    }
  }

  return (
    <div className="fixed top-2 inset-x-2 z-[70] bg-amber-50 dark:bg-amber-950/90 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 rounded-xl p-3 text-sm flex items-start gap-2 shadow-lg">
      <span aria-hidden="true">📱</span>
      <div className="flex-1 leading-relaxed">
        <strong>iPhone&apos;da uygulamayı yüklemek için:</strong>
        <div className="mt-1">
          Alt menüde <strong>⊡</strong> ikonuna dokun →{" "}
          <strong>&ldquo;Safari&apos;de Aç&rdquo;</strong>. Safari&apos;de tekrar bu sayfaya
          gelip Paylaş → <strong>&ldquo;Ana Ekrana Ekle&rdquo;</strong>.
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 text-lg leading-none w-7 h-7 flex items-center justify-center"
        aria-label="Kapat"
      >
        ×
      </button>
    </div>
  );
}
