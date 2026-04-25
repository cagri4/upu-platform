"use client";

import { useState } from "react";

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
        className="fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition"
        aria-label="Paylaş"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {open && (
        <div className="fixed bottom-24 left-5 z-40 bg-white rounded-2xl shadow-xl p-3 w-64 space-y-2 border border-slate-200">
          <button
            onClick={() => { whatsapp(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-green-50 active:bg-green-100 text-left"
          >
            <span className="text-xl">💬</span>
            <span className="text-sm font-medium text-slate-800">WhatsApp ile paylaş</span>
          </button>
          <button
            onClick={() => { void copy(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 active:bg-slate-100 text-left"
          >
            <span className="text-xl">{copied ? "✅" : "🔗"}</span>
            <span className="text-sm font-medium text-slate-800">
              {copied ? "Kopyalandı!" : "Linki kopyala"}
            </span>
          </button>
          {typeof navigator !== "undefined" && (
            <button
              onClick={() => { void nativeShare(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-indigo-50 active:bg-indigo-100 text-left"
            >
              <span className="text-xl">📤</span>
              <span className="text-sm font-medium text-slate-800">Diğer uygulamalar</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
