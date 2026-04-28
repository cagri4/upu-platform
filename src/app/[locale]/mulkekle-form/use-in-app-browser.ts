"use client";

import { useEffect, useState } from "react";

/**
 * In-app browser / WebView tespiti.
 *
 * WhatsApp Custom Tabs, Instagram/FB/Twitter/Line in-app browser ve generic
 * Android WebView (UA "wv") senaryolarında foto upload silent-fail oluyor —
 * SAFE_BATCH=4 cap ve uyarı bubble'ı bu durumlarda devreye girer.
 *
 * URL'de `?chrome=1` veya UA mobile değilse standalone Chrome kabul edilir
 * (ChromeSuggest banner'ından geçilmiş veya desktop kullanıcısı).
 *
 * `bannerDismissed` sadece ChromeSuggest UI'ını gizlemek için ayrı tutulur;
 * kullanıcı WebView'de banner'ı kapattıysa cap hâlâ uygulanmalı.
 */
export function useIsInAppBrowser(): { isInAppBrowser: boolean; bannerDismissed: boolean; isReady: boolean } {
  const [state, setState] = useState({ isInAppBrowser: false, bannerDismissed: false, isReady: false });

  useEffect(() => {
    if (typeof navigator === "undefined") {
      setState({ isInAppBrowser: false, bannerDismissed: false, isReady: true });
      return;
    }
    const ua = navigator.userAgent || "";
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

    let isInAppBrowser = false;
    if (isMobile) {
      const sp = new URLSearchParams(window.location.search);
      const cameFromBanner = sp.get("chrome") === "1";
      if (!cameFromBanner) {
        const isInAppUA = /(WhatsApp|FBAN|FBAV|Instagram|Twitter|Line|wv\)|; wv\b)/i.test(ua);
        const ref = document.referrer || "";
        const fromExternalApp = ref === "" || /^android-app:/i.test(ref);
        isInAppBrowser = isInAppUA || fromExternalApp;
      }
    }

    let bannerDismissed = false;
    try { bannerDismissed = localStorage.getItem("chrome-suggest-dismissed") === "1"; } catch {}

    setState({ isInAppBrowser, bannerDismissed, isReady: true });
  }, []);

  return state;
}
