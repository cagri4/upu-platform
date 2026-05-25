"use client";

import { MessageSquare, MessageCircle } from "lucide-react";
import { HeroBanner } from "@/components/banking";

export default function MarketOneriPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={MessageSquare}
        title="Öneri / Şikayet"
        subtitle="Görüş ve önerilerinizi bizimle paylaşın."
      />

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/70 dark:border-slate-800 shadow-sm text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
          <MessageCircle className="w-7 h-7" strokeWidth={2.2} />
        </div>
        <p className="font-semibold text-slate-900 dark:text-white mb-1.5">Form yakında açılacak</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-4">
          Öneri ve şikayet formu yakında burada açılacak. Şimdilik WhatsApp üzerinden bize ulaşabilirsiniz.
        </p>
        <a
          href="https://wa.me/31644967207?text=%C3%96neri%2F%C5%9Eikayet%3A%20"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition active:scale-95"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={2.4} />
          WhatsApp&apos;tan Yaz
        </a>
      </div>
    </div>
  );
}
