"use client";

import { useSearchParams } from "next/navigation";
import { ReturnButtons } from "@/components/return-buttons";

const BOT_WA_NUMBER = "31644967207";

export default function OneriPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm text-center">
        <div className="text-6xl mb-4">💬</div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Öneri / Şikayet</h1>
        <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
          Yakında: Buradan doğrudan formla bize öneri ve şikayet iletebileceksiniz.
        </p>
        <p className="text-xs text-slate-400 mt-4">
          Şu an WhatsApp&apos;tan mesaj atabilir veya <a href="mailto:hello@upudev.nl" className="underline">hello@upudev.nl</a> adresine yazabilirsiniz.
        </p>
      </div>

      <ReturnButtons token={token || null} botPhone={BOT_WA_NUMBER} />
    </div>
  );
}
