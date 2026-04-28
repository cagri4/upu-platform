"use client";

import { useEffect, useState } from "react";
import { useIsInAppBrowser } from "./use-in-app-browser";

/**
 * Mülk ekle form'unda foto upload sorunlarını önlemek için
 * WebView/in-app browser kullanıcılarını sistem Chrome'una yönlendirir.
 *
 * Algılama use-in-app-browser hook'una taşındı — page.tsx'teki SAFE_BATCH
 * cap'i ile aynı kaynağı paylaşır.
 */
export function ChromeSuggest() {
  const { isInAppBrowser, bannerDismissed, isReady } = useIsInAppBrowser();
  const [dismissedLocal, setDismissedLocal] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!isReady || !isInAppBrowser) return;
    setIsAndroid(/Android/i.test(navigator.userAgent || ""));
    setCurrentUrl(window.location.href);
  }, [isReady, isInAppBrowser]);

  function dismiss() {
    try { localStorage.setItem("chrome-suggest-dismissed", "1"); } catch {}
    setDismissedLocal(true);
  }

  if (!isReady || !isInAppBrowser || bannerDismissed || dismissedLocal) return null;

  // Android: intent:// scheme ile Chrome'a yönlendir
  // iOS: googlechrome:// scheme (Chrome kuruluysa)
  // ?chrome=1 ekleyerek standalone Chrome'da banner'ı tekrar göstermemesini sağla
  let chromeUrl = "";
  if (currentUrl) {
    try {
      const u = new URL(currentUrl);
      const search = u.search ? `${u.search}&chrome=1` : `?chrome=1`;
      if (isAndroid) {
        chromeUrl = `intent://${u.host}${u.pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
      } else {
        chromeUrl = `googlechrome://${u.host}${u.pathname}${search}`;
      }
    } catch {
      chromeUrl = currentUrl;
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4 text-sm relative">
      <button
        onClick={dismiss}
        aria-label="Kapat"
        className="absolute top-2 right-2 w-7 h-7 rounded-full text-amber-700 hover:bg-amber-100 flex items-center justify-center text-base leading-none"
      >
        ✕
      </button>
      <p className="font-semibold text-amber-900 mb-2 pr-8">
        💡 Daha iyi foto yükleme için Chrome&apos;da açın
      </p>
      <p className="text-amber-800 text-xs mb-3 leading-relaxed">
        WhatsApp&apos;ın açtığı tarayıcı 5+ foto seçimini desteklemiyor olabilir.
        Daha güvenli foto yükleme için sayfayı Chrome&apos;da açın.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <a
          href={chromeUrl}
          className="inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm"
        >
          🌐 Chrome&apos;da Aç
        </a>
        <button
          onClick={() => void copy()}
          className="inline-flex items-center justify-center gap-2 bg-white hover:bg-amber-100 text-amber-800 font-medium px-4 py-2.5 rounded-lg text-sm border border-amber-300"
        >
          {copied ? "✅ Kopyalandı!" : "🔗 Linki Kopyala"}
        </button>
      </div>
      <p className="text-xs text-amber-700 mt-3 italic">
        Chrome&apos;da Aç çalışmazsa, linki kopyalayıp Chrome&apos;da yapıştırın.
      </p>
    </div>
  );
}
