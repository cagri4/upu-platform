"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Bell, Sliders } from "lucide-react";
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

  const tabs: Array<{ id: Tab; label: string; Icon: typeof Bell }> = [
    { id: "history", label: "Geçmiş", Icon: Bell },
    { id: "preferences", label: "Tercihler", Icon: Sliders },
  ];

  return (
    <div className="space-y-5 pb-24">
      {/* Hero — sade banking */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bildirimler</h1>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
        {tab === "history"
          ? "Gelen tüm bildirimleri burada görebilirsin."
          : "Hangi bildirimleri WhatsApp'tan almak istediğini seç."}
      </p>

      {/* Tab strip — emerald active underline */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-1">
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
                active
                  ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <t.Icon className="w-4 h-4" strokeWidth={2.2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "history" ? <HistoryView /> : <PreferencesView />}
    </div>
  );
}
