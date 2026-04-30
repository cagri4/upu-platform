"use client";

/**
 * RevisionBadge — küçük "?" + "revizyonlar" widget'ı.
 *
 * Hero + Pricing component'lerinin sol-altına mount edilir. Click →
 * absolute positioned popover, dışarı tıklayınca kapanır.
 *
 * Props:
 *   - componentKey: "hero" | "pricing"
 *   - locale: "tr" | "nl" | "en"
 *   - theme: "dark" (Hero koyu bg) | "light" (Pricing açık bg)
 *
 * Maximum 10 entry görünür; daha fazlası "+N eski revizyon" yazısı
 * (link sayfası 10 sınırına ulaşınca eklenir).
 */

import { useEffect, useRef, useState } from "react";
import { getRevisions, type RevisionComponent } from "../revisions";
import { formatDate } from "@/platform/i18n/datetime";

interface Props {
  componentKey: RevisionComponent;
  locale: "tr" | "nl" | "en";
  theme: "dark" | "light";
  labels: {
    badge: string;       // "revizyonlar" / "revisions" / "revisies"
    title: string;       // "Revizyon Geçmişi"
    no_revisions: string;
    older_count: string; // "+{count} eski revizyon"
    aria_open: string;
  };
}

export function RevisionBadge({ componentKey, locale, theme, labels }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside-click → close
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const revisions = getRevisions(componentKey, locale);
  const visible = revisions.slice(0, 10);
  const olderCount = revisions.length - visible.length;

  const localeStr = locale === "tr" ? "tr-TR" : locale === "nl" ? "nl-NL" : "en-US";

  const trigger = theme === "dark"
    ? "text-slate-400 hover:text-slate-200"
    : "text-slate-400 hover:text-slate-700";

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={labels.aria_open}
        aria-expanded={open}
        className={`text-[11px] flex items-center gap-1 transition-colors ${trigger}`}
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-current text-[10px] leading-none">?</span>
        <span>{labels.badge}</span>
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200 z-50 p-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">{labels.title}</h3>

          {visible.length === 0 ? (
            <p className="text-sm text-slate-500">{labels.no_revisions}</p>
          ) : (
            <ul className="space-y-3">
              {visible.map((r, i) => (
                <li key={`${r.date}-${i}`} className="border-l-2 border-emerald-500 pl-3">
                  <div className="text-[11px] font-semibold text-slate-500">
                    {formatDate(r.date, localeStr as "tr-TR" | "nl-NL" | "en-US")}
                  </div>
                  <div className="text-sm text-slate-700 mt-0.5">{r.description}</div>
                </li>
              ))}
            </ul>
          )}

          {olderCount > 0 && (
            <p className="text-[11px] text-slate-400 mt-3 italic">
              {labels.older_count.replace("{count}", String(olderCount))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
