"use client";

/**
 * Android + WhatsApp in-app webview detect banner.
 *
 * Bot mesajındaki "Paneli Aç" linki Android'de WA in-app WebView'de açılır;
 * orada çerez/oturum kalıcılığı sınırlı, ayrıca PWA install fırsatı yok.
 * Bu component yalnız Android + WhatsApp UA kombinasyonunda + standalone
 * değilse görünür. Dismiss sessionStorage'da hatırlanır (aynı oturumda
 * tekrar görünmez).
 *
 * IosWaBanner'ın Android kardeşi — iki banner birlikte hiç görünmez
 * (UA mutually exclusive).
 */

import { useEffect, useState } from "react";

const DISMISS_KEY = "android-wa-banner-dismissed";

export function AndroidWaBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isWa = /WhatsApp/i.test(ua);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isAndroid && isWa && !isStandalone) {
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
        <strong>Tam deneyim için:</strong>
        <div className="mt-1">
          Sağ üst <strong>⋮</strong> menüden{" "}
          <strong>&ldquo;Tarayıcıda Aç&rdquo;</strong> seçerek Chrome&apos;da devam edin.
          Çerezler ve oturum kalıcı olur.
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
