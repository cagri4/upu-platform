import { useEffect, useState } from "react";

/**
 * WhatsApp dönüş linki üretici — Android Chrome'da Kişisel WA'yı zorlar.
 *
 * Sorun: `wa.me/` URL'i hem WA Personal (`com.whatsapp`) hem WA Business
 * (`com.whatsapp.w4b`) için intent filter'lere kayıtlı. Android her ikisini
 * yüklü bulduğunda chooser dialog gösterir veya kullanıcının önceden
 * "Always" seçtiği uygulamayı açar — emlakçıların telefonunda iki WA olunca
 * çoğunlukla yanlışlıkla Business açılıyor.
 *
 * Strateji:
 *   - Android standalone Chrome → `intent://send?phone=...#...package=com.whatsapp...`
 *     ile Personal'i zorla, fallback `wa.me`. Personal yüklü değilse browser
 *     fallback wa.me'ye geri düşer.
 *   - Android in-app browser (WhatsApp Custom Tabs / FB / IG / Twitter / Line /
 *     generic wv) → zaten `wa.me` ile aynı uygulamaya dönüyor, plain.
 *   - iOS / desktop → plain `wa.me` (intent:// scheme yok).
 *
 * SSR-safe: `navigator` tanımsızsa plain `wa.me` döner.
 */
export function whatsappDeeplink(phone: string): string {
  if (typeof navigator === "undefined") return `https://wa.me/${phone}`;
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser = /(WhatsApp|FBAN|FBAV|Instagram|Twitter|Line|wv\)|; wv\b)/i.test(ua);

  if (isInAppBrowser) return `https://wa.me/${phone}`;

  if (isAndroid) {
    const fallback = encodeURIComponent(`https://wa.me/${phone}`);
    return `intent://send?phone=${phone}#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=${fallback};end`;
  }

  return `https://wa.me/${phone}`;
}

/**
 * Hydration-safe React hook — SSR'de plain `wa.me` render eder, client mount'tan
 * sonra deeplink'e geçer. `<a href={hook()}>` pattern'i için kullan.
 */
export function useWhatsappDeeplink(phone: string): string {
  const [href, setHref] = useState(`https://wa.me/${phone}`);
  useEffect(() => {
    setHref(whatsappDeeplink(phone));
  }, [phone]);
  return href;
}
