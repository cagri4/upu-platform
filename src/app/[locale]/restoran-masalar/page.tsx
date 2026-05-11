"use client";

import { useEffect, useState } from "react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";

interface Table {
  id: string;
  label: string;
  capacity: number | null;
  zone: string | null;
  status: string;
  current_check_amount: number | null;
}

const STATUS_INFO: Record<string, { label: string; cls: string; icon: string }> = {
  free:     { label: "Boş",          cls: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: "🟢" },
  occupied: { label: "Dolu",         cls: "bg-rose-100 text-rose-700 border-rose-300", icon: "🔴" },
  reserved: { label: "Rezerve",      cls: "bg-amber-100 text-amber-700 border-amber-300", icon: "🟡" },
  cleaning: { label: "Temizleniyor", cls: "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600", icon: "🧹" },
};

export default function TablesPage() {
  return (
    <RestoranPanelShell>
      {({ token }) => <Grid token={token} />}
    </RestoranPanelShell>
  );
}

function Grid({ token }: { token: string }) {
  const [items, setItems] = useState<Table[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/restoran-panel/list?type=tables&t=${token}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error || "Yüklenemedi."); return; }
        setItems(json.items);
      } catch { setError("Bağlantı hatası."); }
    })();
  }, [token]);

  // Group by zone
  const zones: Record<string, Table[]> = {};
  for (const t of items || []) {
    const z = t.zone || "Genel";
    (zones[z] = zones[z] || []).push(t);
  }

  const total = items?.length || 0;
  const free = (items || []).filter(t => t.status === "free").length;
  const occupied = (items || []).filter(t => t.status === "occupied").length;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">🍽 Masalar</h1>
      {items && (
        <p className="text-sm text-slate-500 mb-5">
          {total} masa · {free} boş · {occupied} dolu
        </p>
      )}

      {error && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}
      {!items && !error && <div className="text-slate-500">Yükleniyor…</div>}
      {items && items.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow border border-slate-200 dark:border-slate-800/50 p-8 text-center text-slate-500">
          Henüz masa tanımlanmamış.
        </div>
      )}

      {Object.entries(zones).map(([zone, tables]) => (
        <div key={zone} className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{zone}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tables.map(t => {
              const s = STATUS_INFO[t.status] || STATUS_INFO.free;
              return (
                <div
                  key={t.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl border-2 ${s.cls.split(" ").find(c => c.startsWith("border-")) || "border-slate-200 dark:border-slate-800/50"} p-4 text-center shadow-sm`}
                >
                  <div className="text-3xl mb-1">{s.icon}</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-slate-100">Masa {t.label}</div>
                  {t.capacity && <div className="text-xs text-slate-500 mt-0.5">{t.capacity} kişilik</div>}
                  <div className={`text-xs font-medium mt-2 inline-block px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</div>
                  {t.current_check_amount && t.current_check_amount > 0 && (
                    <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold mt-1">
                      €{t.current_check_amount.toLocaleString("tr-NL", { maximumFractionDigits: 0 })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
