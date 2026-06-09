"use client";

/**
 * Öneri / Şikayet — bayi tenant kopyası (placeholder).
 */

import { notFound } from "next/navigation";
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

export default function BayiOneriPage() {
  // B2B Portal MVP Faz 0 uzantısı — feedback için WA var, default OFF.
  if (!isBayiFeatureEnabled("bayi.oneri_feedback")) notFound();
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
    </div>
  );
}
