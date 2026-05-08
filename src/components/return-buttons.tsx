"use client";

import React from "react";

/**
 * Form/sayfa altında 2 buton: Panele Dön + WhatsApp'a Dön.
 *
 * 2026-05-08 fix: WhatsApp'a Dön artık DAİMA `wa.me/<bot>` deeplink'ine gider.
 * Önceki davranış (history.back / window.close fallback) panel-içi sayfalarda
 * (kullanıcı /tr/panel → /tr/mulklerim navigasyonu sonrası) yanlış yöne
 * (panele) götürüyordu — history.length>1 olduğu için. Direct wa.me linki
 * her zaman WA chat'e götürür; mobile'da WA app açılır, desktop'ta web.wa.
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
  async function handleWaClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!onWaReturn) return; // direct link, no JS interception
    e.preventDefault();
    try { await onWaReturn(); } catch { /* swallow */ }
    window.location.href = `https://wa.me/${botPhone}`;
  }

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
        href={`https://wa.me/${botPhone}`}
        onClick={onWaReturn ? handleWaClick : undefined}
        className="block w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white py-4 rounded-xl font-semibold text-base shadow-lg text-center active:scale-95 transition"
      >
        💬 WhatsApp&apos;a Dön
      </a>
    </div>
  );
}
