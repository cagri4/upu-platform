"use client";

/**
 * "Uygulamada Aç" banner — browser tab'da PWA install edilmiş ise sticky
 * üst banner ile tek tıkla PWA'ya geçiş sun.
 *
 * Tetiklenme koşulları (hepsi sağlanmalı):
 *   1. Standalone modda DEĞİL (zaten PWA içindeysek anlamsız)
 *   2. localStorage `pwa_installed_<tenantKey>` flag set (PwaInstallCard'da
 *      accepted outcome veya appinstalled event)
 *   3. sessionStorage snooze deadline geçmiş (× ile 1 saat ertelenir)
 *   4. iOS değil (intent:// iOS'ta çalışmıyor, IosWaBanner zaten o yolu
 *      kapatıyor)
 *
 * Android Chrome intent URI ile PWA'ya redirect; PWA install yoksa Chrome
 * normal browser tab'da kalır (no-op).
 */

import { useEffect, useState } from "react";
import { DOMAIN_MAP } from "@/tenants/config";

function resolveTenantKey(): string {
  if (typeof window === "undefined") return "emlak";
  return DOMAIN_MAP[window.location.host] ?? "emlak";
}

export function OpenInPwaBanner() {
  const [show, setShow] = useState(false);
  const [intentUrl, setIntentUrl] = useState<string>("");

  useEffect(() => {
    // 1. Standalone modda → banner yok
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // 4. iOS → intent URI çalışmıyor, banner gösterme
    const ua = window.navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return;

    // 2. PWA install flag yok → banner yok
    const tenantKey = resolveTenantKey();
    const installed = (() => {
      try {
        return localStorage.getItem(`pwa_installed_${tenantKey}`) === "true";
      } catch {
        return false;
      }
    })();
    if (!installed) return;

    // 3. Snooze check (× ile 1 saat ertelenir)
    const snoozedUntil = (() => {
      try {
        return Number(sessionStorage.getItem("pwa_banner_snoozed_until") || "0");
      } catch {
        return 0;
      }
    })();
    if (snoozedUntil > Date.now()) return;

    // Intent URL — current host + path. PWA installed varsa Android Chrome
    // doğrudan PWA'ya yönlendirir.
    const host = window.location.host;
    const path = window.location.pathname + window.location.search;
    const url =
      `intent://${host}${path}` +
      `#Intent;scheme=https;action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;end`;
    setIntentUrl(url);
    setShow(true);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    setShow(false);
    try {
      sessionStorage.setItem(
        "pwa_banner_snoozed_until",
        String(Date.now() + 3600 * 1000),
      );
    } catch {
      /* sessionStorage blok → bir sonraki sayfa yüklemesinde tekrar görür */
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-indigo-600 text-white px-4 py-2.5 flex items-center gap-3 text-sm shadow-md">
      <span className="text-lg" aria-hidden="true">📱</span>
      <div className="flex-1 leading-tight">Uygulamada daha hızlı çalışır</div>
      <a
        href={intentUrl}
        className="bg-white text-indigo-700 px-3 py-1.5 rounded-md font-medium text-xs whitespace-nowrap hover:bg-indigo-50"
      >
        Aç
      </a>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-indigo-200 hover:text-white text-lg leading-none w-7 h-7 flex items-center justify-center"
        aria-label="Banner'ı kapat"
      >
        ×
      </button>
    </div>
  );
}
