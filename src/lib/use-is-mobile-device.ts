"use client";

/**
 * useIsMobileDevice — UA tabanlı mobile cihaz tespiti (telefon + tablet).
 *
 * "Bilgisayardan Aç" QR butonu sadece mobile'da anlamlı (telefondan masaüstü
 * tarayıcısına geçiş). Desktop'ta butona basınca kamera açılması saçma →
 * bu hook ile gizlenir.
 *
 * Hydration güvenli — ilk render `null` döner (SSR), mount sonrası boolean
 * set edilir. Caller `if (!isMobile) return null` ile gate eder; mount
 * gecikmesi hero ipucu için kabul edilebilir (sayfa içeriği etkilenmez).
 */

import { useEffect, useState } from "react";

export function useIsMobileDevice(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent;
    setIsMobile(/Mobi|Android|iPhone|iPad|iPod/i.test(ua));
  }, []);

  return isMobile;
}
