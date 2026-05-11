"use client";

import { useState } from "react";

/**
 * Sayfa sahibi için sağ üstte sticky owner toolbar.
 * - Panele Dön: cookie session varsa /tr/panel; legacy ?t= akışında ?t= eklenir
 * - Linki Paylaş: Web Share API → fallback clipboard
 * - Düzenle: /api/websayfam/edit-link ile yeni magic link mint edip yönlendirir
 *
 * Public ziyaretçide DOM'a eklenmez (page.tsx'te isOwner guard'ı var).
 */
export function OwnerToolbar({
  slug,
  ownerToken,
}: {
  slug: string;
  ownerToken: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const panelHref = ownerToken ? `/tr/panel?t=${encodeURIComponent(ownerToken)}` : "/tr/panel";

  async function handleEdit() {
    setEditing(true);
    try {
      const res = await fetch(`/api/websayfam/edit-link?slug=${encodeURIComponent(slug)}`, {
        method: "POST",
        credentials: "same-origin",
      });
      const d = await res.json().catch(() => ({}));
      if (d?.url) {
        window.location.href = d.url as string;
      } else {
        alert(d?.error || "Düzenleme linki oluşturulamadı.");
      }
    } catch {
      alert("Bağlantı hatası.");
    } finally {
      setEditing(false);
    }
  }

  async function handleShare() {
    if (typeof window === "undefined") return;
    const url = window.location.origin + window.location.pathname; // ?t= olmadan
    setSharing(true);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ title: "Web Sayfam", url });
        } catch {
          // user cancelled — sessizce yoksay
        }
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200 dark:border-stone-800/50 print:hidden">
      <div className="max-w-5xl mx-auto px-3 md:px-4 py-2.5 flex items-center justify-between gap-2">
        <a
          href={panelHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:text-stone-900 px-3 py-1.5 rounded-full hover:bg-stone-100"
        >
          <span aria-hidden="true">←</span>
          <span>Panele Dön</span>
        </a>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void handleShare()}
            disabled={sharing}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-700 hover:text-stone-900 px-3 py-1.5 rounded-full hover:bg-stone-100 disabled:opacity-60"
            title="Linki Paylaş"
          >
            <span aria-hidden="true">{copied ? "✅" : "🔗"}</span>
            <span className="hidden sm:inline">{copied ? "Kopyalandı" : "Linki Paylaş"}</span>
          </button>
          <button
            onClick={() => void handleEdit()}
            disabled={editing}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-full shadow disabled:opacity-60"
            title="Sayfanı düzenle"
          >
            <span aria-hidden="true">{editing ? "⏳" : "✏️"}</span>
            <span>Düzenle</span>
          </button>
        </div>
      </div>
    </div>
  );
}
