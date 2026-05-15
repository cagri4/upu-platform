"use client";

/**
 * PWA Install Card — paneli ana ekrana yükletmek için.
 *
 * Davranış:
 *   - Standalone modda (zaten yüklü) → kart gizli
 *   - Android Chrome: beforeinstallprompt event'i yakalar, tek tıkla install
 *   - iOS Safari: native install API yok → talimat modali açar
 *   - Diğer (desktop / WebView) → kart gizli
 */

import { useEffect, useState } from "react";
import {
  getCachedPrompt,
  setCachedPrompt,
  subscribeCachedPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa-install-cache";

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !("MSStream" in window)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari özel
  return Boolean(("standalone" in window.navigator) && (window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export interface PwaInstallCardProps {
  /** Tenant-aware kısa marka (örn. "UPU Bayi"). Default "UPU Emlak"
   *  geriye uyumluluk için emlak panel'de prop geçmiyor. */
  brandName?: string;
}

export function PwaInstallCard({ brandName = "UPU Emlak" }: PwaInstallCardProps = {}) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [standalone, setStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosInstructionsOpen, setIosInstructionsOpen] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandalone());

    // RootLayout capturer event'i module-level cache'e koyar; mount anında
    // cache'i oku + sonradan gelecek event'leri subscribe ile yakala.
    setDeferredPrompt(getCachedPrompt());
    const unsub = subscribeCachedPrompt((e) => setDeferredPrompt(e));
    return unsub;
  }, []);

  // Zaten yüklenmişse → gösterme
  if (standalone) return null;
  // Desktop / WebView ise → gösterme (sadece mobile native akışlar için)
  if (platform === "other") return null;

  async function handleInstall() {
    if (platform === "ios") {
      setIosInstructionsOpen(true);
      return;
    }
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        // Chrome event'i tek kullanımlık — cache'i de temizle.
        setCachedPrompt(null);
      }
      return;
    }
    // Chrome bazen beforeinstallprompt vermez (kriter yetersiz vs.)
    // Kullanıcıyı yönlendir: tarayıcı menü → "Ana ekrana ekle"
    setIosInstructionsOpen(true); // android için de generic talimat
  }

  return (
    <>
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="text-3xl flex-shrink-0">📲</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Uygulama Olarak Yükleyin</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              {brandName}&apos;ı ana ekranınıza ekleyin — tarayıcı çubuğu olmadan, gerçek uygulama gibi açılsın.
            </p>
            <button
              onClick={handleInstall}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              📲 Yükle
            </button>
          </div>
        </div>
      </div>

      {iosInstructionsOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">📲 Ana Ekrana Ekle</h2>
              <button
                onClick={() => setIosInstructionsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center"
                aria-label="Kapat"
              >
                ×
              </button>
            </div>

            {platform === "ios" ? (
              <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">1</span>
                  <span>Ekranın altındaki <span className="inline-block bg-slate-100 dark:bg-slate-900 px-1.5 rounded">⤴</span> <span className="font-semibold">Paylaş</span> ikonuna dokunun.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">2</span>
                  <span>Açılan menüde aşağı kaydırıp <span className="font-semibold">&quot;Ana Ekrana Ekle&quot;</span> seçeneğine dokunun.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">3</span>
                  <span>Sağ üstte <span className="font-semibold">&quot;Ekle&quot;</span> butonuna dokunun. {brandName} ana ekranınızda hazır.</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">1</span>
                  <span>Tarayıcının sağ üstündeki <span className="font-semibold">⋮ (üç nokta)</span> menüsünü açın.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">2</span>
                  <span><span className="font-semibold">&quot;Uygulama olarak yükle&quot;</span> ya da <span className="font-semibold">&quot;Ana ekrana ekle&quot;</span> seçeneğine dokunun.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">3</span>
                  <span>Onaylayın — {brandName} ana ekranınızda hazır.</span>
                </li>
              </ol>
            )}

            <button
              onClick={() => setIosInstructionsOpen(false)}
              className="mt-5 w-full bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-900 dark:text-slate-100 py-2.5 rounded-lg text-sm font-medium"
            >
              Anladım
            </button>
          </div>
        </div>
      )}
    </>
  );
}
