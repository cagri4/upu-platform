"use client";

import { useState } from "react";
import { whatsappDeeplink } from "@/lib/whatsapp-deeplink";

const BOT_WA_NUMBER = "31644967207";

/**
 * Sunumun en altındaki "Devam Et" call-to-action.
 * Tıklanınca POST /api/sunum/finish atar, idempotent — server WA'ya
 * "Mülkleri Yönet" mesajı + butonu gönderir, sonra wa.me'ye navigate
 * eder. Tekrar tıklamada WA spam atılmaz (server flag check eder).
 */
export function FinishCTA({ presToken }: { presToken: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch("/api/sunum/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: presToken }),
      });
    } catch {
      // chain devam mesajı server'dan after() ile gider; navigate yine de yap
    }
    window.location.href = whatsappDeeplink(BOT_WA_NUMBER);
  }

  return (
    <div className="text-center py-4 print:hidden">
      <button
        onClick={() => void handleClick()}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold px-8 py-4 rounded-full text-base shadow-md active:scale-95 transition disabled:opacity-60"
      >
        {loading ? "Yönlendiriliyor..." : "✅ Devam Et"}
      </button>
      <p className="text-xs text-stone-400 mt-2">
        Sunumu bitirdiğinizde tıklayın — WhatsApp&apos;a dönerek mülklerinizi yönetebilirsiniz.
      </p>
    </div>
  );
}
