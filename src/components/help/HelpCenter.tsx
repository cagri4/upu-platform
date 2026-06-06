"use client";

/**
 * HelpCenter — sağ-alt floating "Kullanım Kılavuzu" butonu + drawer.
 *
 * 2026-06-06 pivotu: AI Eleman chatbot + İlk Karşılama wizard'ı kaldırıldı,
 * yerine statik markdown kılavuz. Kullanıcı istediğinde okur.
 *
 * Props:
 *   - saasKey: "bayi" | "emlak" | ... (içerik + localStorage namespace)
 *   - locale: "tr" | "en" | "nl" (markdown dosyası seçimi)
 *   - content: parse edilmiş HelpDoc (server side import edilip prop ile gelir,
 *     "use client" client bundle'a markdown sokmamak için)
 *
 * Davranış:
 *   - Floating button sağ alt (mobile safe-area aware)
 *   - İlk girişte HelpBadge yanında pulse (localStorage flag false ise)
 *   - Click → drawer aç (yarım ekran modal, mobile full-screen)
 *   - Sol bölüm: section nav, sağ bölüm: markdown render
 *   - ESC veya × ile kapat
 */

import { useEffect, useMemo, useState } from "react";
import { BookOpen, X, ChevronRight } from "lucide-react";
import { HelpBadge } from "./HelpBadge";
import type { HelpDoc, HelpSection, HelpBlock, InlineToken } from "./help-parser";
import { tokenizeInline } from "./help-parser";

interface Props {
  saasKey: string;
  content: HelpDoc;
}

export function HelpCenter({ saasKey, content }: Props) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(content.sections[0]?.id ?? "");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const activeSection = useMemo(
    () => content.sections.find((s) => s.id === activeId) ?? content.sections[0],
    [activeId, content.sections],
  );

  function handleOpen() {
    // Badge gözüküyorsa da kaybolsun
    try {
      window.localStorage.setItem(`helpCenter:${saasKey}:seen`, "1");
    } catch {
      // ignore
    }
    setOpen(true);
  }

  return (
    <>
      <div
        className="fixed z-40 flex items-center"
        style={{
          right: "1.25rem",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)",
        }}
      >
        <HelpBadge saasKey={saasKey} onDismiss={handleOpen} />
        <button
          onClick={handleOpen}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-full shadow-xl transition"
          aria-label="Kullanım kılavuzunu aç"
        >
          <BookOpen className="w-5 h-5" />
          <span className="hidden sm:inline text-sm font-medium">Kılavuz</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50 p-0 sm:p-4">
          <div className="bg-slate-900 text-white w-full sm:w-[640px] sm:max-w-[90vw] sm:rounded-xl border border-slate-700 flex flex-col overflow-hidden">
            <header className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 bg-slate-800">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-semibold flex-1 truncate">{content.title}</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
              <nav className="sm:w-48 sm:flex-shrink-0 border-b sm:border-b-0 sm:border-r border-slate-700 bg-slate-900/40 overflow-x-auto sm:overflow-y-auto">
                <ul className="flex sm:flex-col p-2 gap-1 sm:gap-0.5">
                  {content.sections.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setActiveId(s.id)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded whitespace-nowrap sm:whitespace-normal flex items-center justify-between gap-1 transition ${
                          activeId === s.id
                            ? "bg-indigo-500/20 text-indigo-200"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        }`}
                      >
                        <span className="truncate">{s.title}</span>
                        <ChevronRight
                          className={`w-3 h-3 flex-shrink-0 ${activeId === s.id ? "" : "opacity-0"}`}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              <article className="flex-1 overflow-y-auto px-5 py-5 min-w-0">
                {activeSection && <SectionView section={activeSection} />}
              </article>
            </div>

            <footer className="px-5 py-3 border-t border-slate-700 bg-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Eksik bir konu var mı? WhatsApp&apos;tan bildir.</span>
              <span className="font-mono">{saasKey}</span>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function SectionView({ section }: { section: HelpSection }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-white">{section.title}</h3>
      {section.blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: HelpBlock }) {
  if (block.type === "h3") {
    return <h4 className="text-sm font-semibold text-indigo-300 mt-2">{block.text}</h4>;
  }
  if (block.type === "p") {
    return (
      <p className="text-sm text-slate-300 leading-relaxed">
        <Inline text={block.text} />
      </p>
    );
  }
  return (
    <ul className="space-y-1 pl-4 list-disc text-sm text-slate-300">
      {block.items.map((it, i) => (
        <li key={i} className="leading-relaxed">
          <Inline text={it} />
        </li>
      ))}
    </ul>
  );
}

function Inline({ text }: { text: string }) {
  const tokens = useMemo<InlineToken[]>(() => tokenizeInline(text), [text]);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === "bold") return <strong key={i} className="text-white">{t.text}</strong>;
        if (t.type === "link")
          return (
            <a
              key={i}
              href={t.href}
              target={t.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              {t.text}
            </a>
          );
        return <span key={i}>{t.text}</span>;
      })}
    </>
  );
}
