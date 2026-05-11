"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { HistoryView } from "./history-view";
import { PreferencesView } from "./preferences-view";

type Tab = "history" | "preferences";

export default function BildirimlerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialTab = ((searchParams.get("tab") || "history") === "preferences"
    ? "preferences"
    : "history") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    const next = `${pathname}?${params.toString()}`;
    router.replace(next, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Hero */}
        <div className="bg-gradient-to-br from-yellow-500 to-amber-600 text-white rounded-2xl p-5">
          <div className="text-3xl mb-1">🔔</div>
          <h1 className="text-xl font-bold">Bildirimler</h1>
          <p className="text-amber-100 text-sm mt-1">
            {tab === "history"
              ? "Gelen tüm bildirimleri burada görebilirsin."
              : "Hangi bildirimleri WhatsApp'tan almak istediğini seç."}
          </p>
        </div>

        {/* Tab strip */}
        <div className="grid grid-cols-2 bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {(["history", "preferences"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium transition ${
                tab === t
                  ? "bg-amber-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t === "history" ? "Geçmiş" : "Tercihler"}
            </button>
          ))}
        </div>

        {tab === "history" ? <HistoryView /> : <PreferencesView />}
      </div>
    </div>
  );
}
