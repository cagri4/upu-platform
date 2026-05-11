"use client";

/**
 * PWA Update Banner — yeni deploy detection.
 *
 * Mount edildiğinde /api/app-version'ı çağırır, version'u localStorage'a
 * yazar. 60 saniyede bir tekrar poll eder. Yeni version detect ederse
 * sticky bottom banner gösterir: "Yenile" → window.location.reload()
 * (PWA service worker yoksa cache temizleme gereksiz, normal reload
 * yeni asset'leri Next.js manifest üzerinden alır).
 *
 * "Sonra" → banner gizlenir, sonraki poll'da version değişikse tekrar
 * gelir.
 */
import { useEffect, useState } from "react";

const STORAGE_KEY = "upu_app_version";
const POLL_MS = 60_000;

export function PwaUpdateBanner() {
  const [hidden, setHidden] = useState(true);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    let cancelled = false;

    async function check() {
      try {
        const r = await fetch("/api/app-version", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        const v = d?.version as string | undefined;
        if (!v || cancelled) return;
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (!stored) {
          // İlk yükleme — kaydet, banner gösterme.
          window.localStorage.setItem(STORAGE_KEY, v);
          return;
        }
        if (stored !== v) {
          setLatestVersion(v);
          setHidden(false);
        }
      } catch {
        /* silent */
      }
    }

    void check();
    timer = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, []);

  function applyReload() {
    if (typeof window === "undefined" || !latestVersion) return;
    window.localStorage.setItem(STORAGE_KEY, latestVersion);
    window.location.reload();
  }

  function snooze() {
    setHidden(true);
    // localStorage'a yazmıyoruz — sonraki poll'da hâlâ farklıysa tekrar gösterir.
  }

  if (hidden || !latestVersion) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] max-w-md w-[calc(100%-2rem)] print:hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
        <span className="text-xl flex-shrink-0">🔄</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Yeni güncelleme hazır</p>
          <p className="text-xs text-indigo-100">Yenileyerek en güncel sürüme geç.</p>
        </div>
        <button
          onClick={snooze}
          className="text-xs text-indigo-100 hover:text-white px-2 py-1 rounded"
        >
          Sonra
        </button>
        <button
          onClick={applyReload}
          className="bg-white text-indigo-700 hover:bg-indigo-50 text-sm font-semibold px-3 py-1.5 rounded-lg shadow"
        >
          Yenile
        </button>
      </div>
    </div>
  );
}
