"use client";

/**
 * Aktif Öneriler full liste sayfası — Faz B 3.8.
 * Filter: open / acted / dismissed / all.
 */
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Rec {
  id: string; rule_code: string; title: string; body: string;
  action_type: string; action_payload: { navigate?: string } & Record<string, unknown>;
  severity: "low" | "normal" | "high"; score: number;
  status: string; created_at: string;
}

const SEV = {
  high: { label: "🔴 Yüksek", cls: "border-rose-300 bg-rose-50" },
  normal: { label: "🟡 Normal", cls: "border-amber-300 bg-amber-50" },
  low: { label: "🟢 Düşük", cls: "border-slate-200 bg-white" },
} as const;

const STATUS_TABS = [
  { id: "open", label: "Açık" },
  { id: "acted", label: "Yapıldı" },
  { id: "dismissed", label: "Kapatıldı" },
  { id: "all", label: "Tümü" },
];

export default function BayiOnerilerPage() {
  const params = useSearchParams();
  const token = params.get("t") || "";
  const [items, setItems] = useState<Rec[]>([]);
  const [tab, setTab] = useState<string>("open");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ status: tab, limit: "100" });
    if (token) qs.set("t", token);
    const r = await fetch(`/api/recommendations/list?${qs}`, { credentials: "same-origin" });
    const d = await r.json();
    if (r.ok) setItems(d.recommendations || []);
    setLoading(false);
  }, [tab, token]);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, choice: "accept" | "dismiss", nav?: string) {
    await fetch("/api/recommendations/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: token || undefined, id, choice }),
    });
    if (choice === "accept" && nav) {
      window.location.href = token ? `${nav}${nav.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}` : nav;
      return;
    }
    await load();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">💡 Aktif Öneriler</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sistem son N gün veriyi tarayıp aksiyon önerisi çıkarır.
        </p>
      </header>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${tab === t.id ? "bg-indigo-600 text-white" : "bg-white dark:bg-slate-800 border border-slate-200 text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-sm text-slate-500 py-6">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800/50 rounded-xl p-8 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm text-slate-500">Bu sekmede öneri yok.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(r => {
            const nav = r.action_payload?.navigate as string | undefined;
            const meta = SEV[r.severity];
            return (
              <div key={r.id} className={`border rounded-xl p-4 ${meta.cls}`}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h3 className="font-semibold text-slate-900">{r.title}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-slate-700">{meta.label}</span>
                </div>
                <p className="text-sm text-slate-700 mb-2">{r.body}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    {new Date(r.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} · skor {Math.round(r.score)}
                  </span>
                  {r.status === "open" && (
                    <div className="flex gap-1.5">
                      <button onClick={() => void act(r.id, "accept", nav)} className="text-xs px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium">Şimdi yap</button>
                      <button onClick={() => void act(r.id, "dismiss")} className="text-xs px-3 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-600">Kapat</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
