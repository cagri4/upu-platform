"use client";

/**
 * Thin React hook wrapper for driver.js
 *
 * Why a custom wrapper:
 *   - driver.js native vanilla JS; React'te lifecycle yönetimi (mount,
 *     unmount, navigation arası temizleme) hook'la kapsüllemek gerekiyor.
 *   - "use client" only — Next 16 App Router'da panel sayfalarında kullanılır.
 *
 * API:
 *   const { start, isActive } = useDriverTour({
 *     steps,
 *     onClose,  // tour bitti (Bitir veya X — her ikisi de "görüldü" sayılır)
 *   });
 *
 * driver.js CSS side-effect import — sayfa bundle'a ekler.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

export interface UseDriverTourOptions {
  steps: DriveStep[];
  /** Tour kapandı (Bitir / Atla / X) — kalıcı persist için tetiklenir. */
  onClose?: () => void;
  popoverClass?: string;
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
}

export function useDriverTour(opts: UseDriverTourOptions) {
  const driverRef = useRef<Driver | null>(null);
  const [isActive, setIsActive] = useState(false);
  // onClose stale-closure önleme: callback'i ref'te tut
  const onCloseRef = useRef(opts.onClose);
  useEffect(() => { onCloseRef.current = opts.onClose; }, [opts.onClose]);

  // Unmount guard
  useEffect(() => {
    return () => {
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
      driverRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy();
    }
    const d = driver({
      showProgress: true,
      allowClose: true,
      smoothScroll: true,
      stagePadding: 6,
      popoverClass: opts.popoverClass || "upu-tour-popover",
      nextBtnText: opts.nextBtnText || "İleri →",
      prevBtnText: opts.prevBtnText || "← Geri",
      doneBtnText: opts.doneBtnText || "Bitir ✓",
      onDestroyed: () => {
        setIsActive(false);
        onCloseRef.current?.();
      },
      steps: opts.steps,
    });
    driverRef.current = d;
    d.drive();
    setIsActive(true);
  }, [opts.steps, opts.popoverClass, opts.nextBtnText, opts.prevBtnText, opts.doneBtnText]);

  return { start, isActive };
}
