"use client";

import { useState } from "react";
import { Share2, MessageCircle, Copy, Check, Send } from "lucide-react";

export function ShareFAB({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  function getUrl() {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }

  function shareText() {
    return `${title}\n\n${getUrl()}`;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(getUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function whatsapp() {
    const text = encodeURIComponent(shareText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: title, url: getUrl() });
      } catch {
        // user cancelled
      }
    } else {
      whatsapp();
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center justify-center active:scale-95 transition"
        aria-label="Paylaş"
      >
        <Share2 className="w-6 h-6" strokeWidth={2.2} />
      </button>

      {open && (
        <div className="fixed bottom-24 left-5 z-40 bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-3 w-64 space-y-1 border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => { whatsapp(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/30 active:bg-emerald-100 dark:active:bg-emerald-900/40 text-left transition"
          >
            <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={2.2} />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">WhatsApp ile paylaş</span>
          </button>
          <button
            onClick={() => { void copy(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 text-left transition"
          >
            {copied ? (
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
            ) : (
              <Copy className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0" strokeWidth={2.2} />
            )}
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {copied ? "Kopyalandı" : "Linki kopyala"}
            </span>
          </button>
          {typeof navigator !== "undefined" && (
            <button
              onClick={() => { void nativeShare(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-700 text-left transition"
            >
              <Send className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0" strokeWidth={2.2} />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Diğer uygulamalar</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
