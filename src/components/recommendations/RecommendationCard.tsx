"use client";

/**
 * Aktif Öneri kart widget — dashboard üstüne mount edilir.
 * Top 3 open recommendation göster + 1-tıkla accept/dismiss.
 */
import { useEffect, useState, useCallback } from "react";

interface Rec {
  id: string;
  title: string;
  body: string;
  action_type: string;
  action_payload: { navigate?: string } & Record<string, unknown>;
  severity: "low" | "normal" | "high";
  score: number;
}

const SEVERITY_CLS = {
  high: "border-rose-300 bg-rose-50",
  normal: "border-amber-300 bg-amber-50",
  low: "border-slate-200 bg-white",
} as const;

export function RecommendationCard({ token = "" }: { token?: string }) {
  const [items, setItems] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    const qs = token ? `?t=${encodeURIComponent(token)}&limit=3` : "?limit=3";
    try {
      const r = await fetch(`/api/recommendations/list${qs}`, { credentials: "same-origin" });
      if (r.status === 401 || r.status === 403) { setHidden(true); return; }
      const d = await r.json();
      if (d?.recommendations) setItems(d.recommendations.slice(0, 3));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, choice: "accept" | "dismiss", nav?: string) {
    await fetch("/api/recommendations/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token: token || undefined, id, choice }),
    });
    if (choice === "accept" && nav) {
      const url = token ? `${nav}${nav.includes("?") ? "&" : "?"}t=${encodeURIComponent(token)}` : nav;
      window.location.href = url;
      return;
    }
    await load();
  }

  if (hidden || loading || items.length === 0) return null;

  return (
    <section className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">💡 Sana özel {items.length} öneri</h2>
        <a href={token ? `/tr/bayi-oneriler?t=${encodeURIComponent(token)}` : "/tr/bayi-oneriler"} className="text-xs text-indigo-600 hover:underline">Tümünü gör →</a>
      </div>
      <div className="space-y-2">
        {items.map(r => {
          const nav = r.action_payload?.navigate as string | undefined;
          return (
            <div key={r.id} className={`border rounded-lg p-3 ${SEVERITY_CLS[r.severity]}`}>
              <div className="text-sm font-medium text-slate-900">{r.title}</div>
              <p className="text-xs text-slate-700 mt-0.5">{r.body}</p>
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => void act(r.id, "accept", nav)}
                  className="text-xs px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  Şimdi yap
                </button>
                <button
                  onClick={() => void act(r.id, "dismiss")}
                  className="text-xs px-3 py-1 rounded-md bg-white hover:bg-slate-50 border border-slate-200 text-slate-600"
                >
                  Kapat
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
