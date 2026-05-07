"use client";

import { useEffect, useState } from "react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  is_available: boolean;
  prep_minutes: number | null;
}

function fmtEur(n: number): string {
  const decimals = Math.abs(n) < 100 ? 2 : 0;
  return `€${n.toLocaleString("tr-NL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export default function MenuPage() {
  return (
    <RestoranPanelShell>
      {({ token }) => <List token={token} />}
    </RestoranPanelShell>
  );
}

function List({ token }: { token: string }) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/restoran-panel/list?type=menu&t=${token}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error || "Yüklenemedi."); return; }
        setItems(json.items);
      } catch { setError("Bağlantı hatası."); }
    })();
  }, [token]);

  const cats: Record<string, MenuItem[]> = {};
  for (const m of items || []) {
    const c = m.category || "Diğer";
    (cats[c] = cats[c] || []).push(m);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">📋 Menü</h1>
      {items && (
        <p className="text-sm text-slate-500 mb-5">
          {items.length} kalem · {Object.keys(cats).length} kategori
        </p>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}
      {!items && !error && <div className="text-slate-500">Yükleniyor…</div>}

      {items && items.length === 0 && (
        <div className="bg-white rounded-2xl shadow border border-slate-200 p-8 text-center text-slate-500">
          Henüz menü kalemi yok.
        </div>
      )}

      {Object.entries(cats).map(([cat, list]) => (
        <div key={cat} className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{cat}</h2>
          <div className="bg-white rounded-2xl shadow border border-slate-200 divide-y divide-slate-100">
            {list.map(m => (
              <div key={m.id} className="p-4 sm:p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{m.name}</span>
                    {!m.is_available && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">Tükendi</span>
                    )}
                    {m.prep_minutes && (
                      <span className="text-xs text-slate-400">⏱ {m.prep_minutes}dk</span>
                    )}
                  </div>
                  {m.description && <div className="text-sm text-slate-500 mt-0.5">{m.description}</div>}
                </div>
                <div className="text-base font-semibold text-slate-900 flex-shrink-0">{fmtEur(m.price)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
