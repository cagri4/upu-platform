"use client";

/**
 * PWA Install Capturer — RootLayout'ta tek instance.
 *
 * `beforeinstallprompt` ve `appinstalled` event'lerini mümkün olan en erken
 * (Next.js client root mount'unda) yakalar, `setCachedPrompt` ile module-level
 * cache'e yazar. Tüm PwaInstallCard tüketicileri cache'ten okur veya subscribe
 * olur → geç mount eden tenant layout'larında event kaybolmaz.
 */

import { useEffect } from "react";
import {
  setCachedPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa-install-cache";

export function PwaInstallCapturer() {
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setCachedPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setCachedPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
