import { useEffect, useState } from "react";

/**
 * Sahibinden link üretici — Android'de Sahibinden app'ini (com.sahibinden) zorlar.
 *
 * Sorun: emlakçılar liste sayfalarında "Sahibinden'de gör" tıkladığında link
 * tarayıcıda açılıyor; oysa telefonda Sahibinden app yüklüyse uygulama
 * deneyimi çok daha hızlı (login state, favoriler, hızlı arama).
 *
 * Strateji:
 *   - Android (Chrome veya in-app) → `intent://...#...package=com.sahibinden;
 *     S.browser_fallback_url=...` ile app'i aç. Yüklü değilse fallback URL
 *     ile aynı sayfaya geri düşer.
 *   - iOS / desktop → orijinal URL (intent:// scheme yok). iOS'ta Universal
 *     Link otomatik çalışır eğer app yüklüyse.
 *
 * SSR-safe: navigator tanımsızsa orijinal URL döner.
 */
export function sahibindenDeeplink(url: string): string {
  if (typeof navigator === "undefined") return url;
  const ua = navigator.userAgent || "";
  if (!/Android/i.test(ua)) return url;

  try {
    const u = new URL(url);
    const fallback = encodeURIComponent(url);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.sahibinden;S.browser_fallback_url=${fallback};end`;
  } catch {
    return url;
  }
}

/**
 * Hydration-safe React hook — SSR'de orijinal URL render eder, client mount
 * sonrası deeplink'e geçer. Liste içinde her item için ayrı hook gerektiği
 * için tek-URL'lik bileşen wrapper'ında (`SahibindenLink`) kullanılması
 * pratiktir.
 */
export function useSahibindenDeeplink(url: string): string {
  const [href, setHref] = useState(url);
  useEffect(() => {
    setHref(sahibindenDeeplink(url));
  }, [url]);
  return href;
}
