"use client";

import { useEffect, useState } from "react";

/**
 * Mülk ekle form'unda foto upload sorunlarını önlemek için
 * WebView/in-app browser kullanıcılarını sistem Chrome'una yönlendirir.
 *
 * Algılama:
 * - WhatsApp WebView (UA: "WhatsApp")
 * - Instagram, Facebook, Twitter in-app browsers
 * - Generic Android WebView (UA: "wv" veya Chrome version bilgisi eksik)
 *
 * Desktop ve standalone Chrome kullanıcılarına hiç gösterilmez.
 */
export function ChromeSuggest() {
  const [show, setShow] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";

    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (!isMobile) return;

    // Standalone Chrome zaten OK
    const isStandaloneChrome = /CriOS|Chrome\//i.test(ua) && !/wv\)|; wv\b/i.test(ua) && !/(WhatsApp|FBAN|FBAV|Instagram|Twitter|Line)/i.test(ua);
    if (isStandaloneChrome) return;

    setIsAndroid(/Android/i.test(ua));
    setCurrentUrl(window.location.href);
    setShow(true);
  }, []);

  if (!show) return null;

  // Android: intent:// scheme ile Chrome'a yönlendir
  // iOS: googlechrome:// scheme (Chrome kuruluysa)
  let chromeUrl = "";
  if (currentUrl) {
    try {
      const u = new URL(currentUrl);
      if (isAndroid) {
        chromeUrl = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
      } else {
        chromeUrl = `googlechrome://${u.host}${u.pathname}${u.search}`;
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
    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-4 text-sm">
      <p className="font-semibold text-amber-900 mb-2">
        💡 Daha iyi foto yükleme için Chrome&apos;da açın
      </p>
      <p className="text-amber-800 text-xs mb-3 leading-relaxed">
        Şu an WhatsApp tarayıcısındasınız. WhatsApp tarayıcısı bazı durumlarda 5+ foto seçimini desteklemiyor.
        Daha güvenli bir deneyim için bu sayfayı Chrome&apos;da açın.
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
