"use client";

import { useEffect, useState } from "react";
import { whatsappDeeplink } from "@/lib/whatsapp-deeplink";

const WEBVIEW_RE = /(WhatsApp|FBAN|FBAV|Instagram|Twitter|Line|wv\)|; wv\b)/i;

/**
 * Form/sayfa altında 2 buton: Panele Dön + WhatsApp'a Dön.
 *
 * WhatsApp WebView içinden açılan sayfalarda, intent:// scheme'i
 * "başka uygulama açılıyor" uyarısı gösteriyor. Detection: UA paterni
 * WebView'i imzalarsa, WA butonuna tıklandığında window.history.back()
 * ile aynı sekmede geri git (uyarı yok, kullanıcı zaten WA içinde).
 *
 * Standart Chrome/Safari'de eski davranış (Android intent veya wa.me
 * deeplink) korunur.
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
  const [isInWebView, setIsInWebView] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsInWebView(WEBVIEW_RE.test(navigator.userAgent || ""));
  }, []);

  async function handleWaClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (onWaReturn) {
      try { await onWaReturn(); } catch { /* swallow */ }
    }
    if (isInWebView) {
      // WhatsApp WebView içinde — yeni uygulama açma uyarısı yerine geri git.
      e.preventDefault();
      try {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.close();
        }
      } catch {
        window.close();
      }
    }
    // Standart tarayıcı: link normal davranır (whatsappDeeplink).
  }

  const waHref = whatsappDeeplink(botPhone);
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
        href={waHref}
        onClick={handleWaClick}
        className="block w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-4 rounded-xl font-semibold text-base shadow-lg text-center active:scale-95 transition"
      >
        💬 WhatsApp&apos;a Dön
      </a>
    </div>
  );
}
