"use client";

/**
 * Bayi Panel — intro tooltip tour (driver.js).
 *
 * 7 adım:
 *   1) Welcome (popover only)         — Merhaba {ad}, Bayi paneline hoş geldin
 *   2) HIZLI İŞLEM                    — data-tour="quick-actions"
 *   3) KPI grid                       — data-tour="kpi-grid"
 *   4) AI Eleman                      — data-tour="ai-agent"
 *   5) Bildirim çanı (topbar)         — data-tour="notification-bell"
 *   6) Düzenle butonu                 — data-tour="edit-toggle"
 *   7) Kapanış (popover only)         — Hazırsın!
 *
 * Trigger:
 *   - İlk açılışta (profile.metadata.tour_seen_at NULL) otomatik
 *   - "Tanıtım Turu" sidebar item'ı ?tour=1 query ile manuel
 *
 * Persist:
 *   - Tamam / Atla → POST /api/profile/tour-complete (idempotent)
 *
 * i18n: messages/<locale>.json `bayiTour.*` namespace; tr/en/nl mevcut.
 */
import { useCallback, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useDriverTour } from "./use-driver-tour";

export interface BayiPanelTourProps {
  /** Profil-kurulum sonrası displayName — welcome step'te kullanılır. */
  displayName?: string | null;
  /** false ise auto-start atlanır (profile fetch henüz tamamlanmadı). */
  autoStartEnabled: boolean;
  /** profile.metadata.tour_seen_at — set ise auto-start yok. */
  tourSeenAt: string | null;
}

export function BayiPanelTour({ displayName, autoStartEnabled, tourSeenAt }: BayiPanelTourProps) {
  const t = useTranslations("bayiTour");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || "";
  const startedRef = useRef(false);

  const persistComplete = useCallback(async () => {
    try {
      await fetch("/api/profile/tour-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tour_key: "bayi_panel" }),
      });
    } catch {
      // sessiz — bir sonraki açılışta yeniden başlayabilir
    }
  }, []);

  const greeting = displayName
    ? t("welcome_greet_named", { name: displayName })
    : t("welcome_greet");

  const steps = [
    {
      popover: {
        title: greeting,
        description: t("welcome_desc"),
        side: "over" as const,
        align: "center" as const,
      },
    },
    {
      element: '[data-tour="quick-actions"]',
      popover: {
        title: t("quick_title"),
        description: t("quick_desc"),
        side: "bottom" as const,
        align: "start" as const,
      },
    },
    {
      element: '[data-tour="kpi-grid"]',
      popover: {
        title: t("kpi_title"),
        description: t("kpi_desc"),
        side: "top" as const,
        align: "center" as const,
      },
    },
    {
      element: '[data-tour="ai-agent"]',
      popover: {
        title: t("ai_title"),
        description: t("ai_desc"),
        side: "left" as const,
        align: "end" as const,
      },
    },
    {
      element: '[data-tour="notification-bell"]',
      popover: {
        title: t("bell_title"),
        description: t("bell_desc"),
        side: "bottom" as const,
        align: "end" as const,
      },
    },
    {
      element: '[data-tour="edit-toggle"]',
      popover: {
        title: t("edit_title"),
        description: t("edit_desc"),
        side: "left" as const,
        align: "start" as const,
      },
    },
    {
      popover: {
        title: t("done_title"),
        description: t("done_desc"),
        side: "over" as const,
        align: "center" as const,
      },
    },
  ];

  const { start } = useDriverTour({
    steps,
    onClose: persistComplete,
    nextBtnText: t("next"),
    prevBtnText: t("prev"),
    doneBtnText: t("done"),
  });

  // Manual trigger via ?tour=1 — kalıcı seen flag'ini görmezden gel.
  useEffect(() => {
    if (searchParams.get("tour") !== "1") return;
    if (startedRef.current) return;
    startedRef.current = true;
    const id = window.setTimeout(() => {
      start();
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      router.replace(url.pathname + (url.search || ""));
    }, 400);
    return () => window.clearTimeout(id);
  }, [searchParams, start, router]);

  // Auto-start: ilk girişte (tour_seen_at NULL + autoStartEnabled).
  useEffect(() => {
    if (!autoStartEnabled) return;
    if (tourSeenAt) return;
    if (startedRef.current) return;
    if (searchParams.get("tour") === "1") return;
    startedRef.current = true;
    const id = window.setTimeout(() => start(), 600);
    return () => window.clearTimeout(id);
  }, [autoStartEnabled, tourSeenAt, start, searchParams]);

  // Pathname değişirse — auto-start state reset
  useEffect(() => {
    startedRef.current = false;
  }, [pathname]);

  return null;
}
