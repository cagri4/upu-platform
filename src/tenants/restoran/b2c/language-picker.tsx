"use client";

/**
 * Bayrak seçici — Butlaroo paterni (NL/EN/TR/FR/DE/IT).
 *
 * Restoran'ın enabled_languages[] ile filtrelenmiş diller görünür.
 * Default selected: localStorage > default_language > 'tr'.
 * Seçim localStorage'a yazılır + onChange callback ile parent'a bildirilir.
 *
 * UI: floating sticky button (sağ üst) → açılırsa bayrak grid.
 */
import { useEffect, useState } from "react";
import { Languages, X, Check } from "lucide-react";
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  getStoredLanguage,
  setStoredLanguage,
  isSupportedLanguage,
} from "./i18n";

export function LanguagePicker({
  slug,
  enabledLanguages,
  defaultLanguage,
  onChange,
}: {
  slug: string;
  enabledLanguages: string[];
  defaultLanguage: string;
  onChange: (lang: SupportedLanguage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<SupportedLanguage>("tr");

  // Hydrate from localStorage
  useEffect(() => {
    const stored = getStoredLanguage(slug);
    const initial: SupportedLanguage = stored
      ? stored
      : isSupportedLanguage(defaultLanguage)
        ? defaultLanguage
        : "tr";
    setCurrent(initial);
    onChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, defaultLanguage]);

  // Tek dil varsa picker'ı gösterme
  const langs = SUPPORTED_LANGUAGES.filter((l) => enabledLanguages.includes(l));
  if (langs.length <= 1) return null;

  function select(lang: SupportedLanguage) {
    setCurrent(lang);
    setStoredLanguage(slug, lang);
    onChange(lang);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition"
        aria-label="Dil değiştir"
      >
        <span className="text-base leading-none">{LANGUAGE_LABELS[current].flag}</span>
        <Languages className="w-3.5 h-3.5" strokeWidth={2.4} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Dil seçin
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-2">
              {langs.map((lang) => {
                const label = LANGUAGE_LABELS[lang];
                const isActive = current === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => select(lang)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                      isActive
                        ? "border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <span className="text-2xl leading-none">{label.flag}</span>
                    <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {label.name}
                    </span>
                    {isActive && (
                      <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" strokeWidth={2.4} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
