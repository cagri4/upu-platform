"use client";

import { useEffect, useState } from "react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";

interface Member {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  birthday: string | null;
  visit_count: number;
  total_spent: number;
  last_visit_at: string | null;
  favorite_items: string[] | null;
  notes: string | null;
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString("tr-NL", { maximumFractionDigits: 0 })}`;
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function MembersPage() {
  return (
    <RestoranPanelShell>
      {({ token }) => <List token={token} />}
    </RestoranPanelShell>
  );
}

function List({ token }: { token: string }) {
  const [items, setItems] = useState<Member[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/restoran-panel/list?type=members&t=${token}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error || "Yüklenemedi."); return; }
        setItems(json.items);
      } catch { setError("Bağlantı hatası."); }
    })();
  }, [token]);

  const totalSpent = (items || []).reduce((s, m) => s + (m.total_spent || 0), 0);
  const todayMD = new Date().toISOString().slice(5, 10);
  const birthdaysToday = (items || []).filter(m => m.birthday === todayMD);
  const dormant = (items || []).filter(m => {
    const d = daysSince(m.last_visit_at);
    return d != null && d > 14 && m.visit_count >= 5;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">💝 Müdavimler</h1>
      {items && (
        <p className="text-sm text-slate-500 mb-5">
          {items.length} üye · toplam {fmtEur(totalSpent)} harcama
        </p>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}
      {!items && !error && <div className="text-slate-500">Yükleniyor…</div>}

      {items && items.length === 0 && (
        <div className="bg-white rounded-2xl shadow border border-slate-200 p-8 text-center text-slate-500">
          Henüz müdavim yok. WA&apos;dan <code>uye ol</code> davet linki paylaşabilirsiniz.
        </div>
      )}

      {birthdaysToday.length > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5">
          <h2 className="text-sm font-semibold text-violet-900 mb-2">🎂 Bugün doğum günü olanlar</h2>
          <p className="text-sm text-violet-700">
            {birthdaysToday.map(m => m.guest_name).join(" · ")}
          </p>
        </div>
      )}

      {dormant.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">💤 Geri çağırma adayları (2+ hafta yok)</h2>
          <ul className="text-sm text-amber-700 space-y-0.5">
            {dormant.slice(0, 5).map(m => (
              <li key={m.id}>• {m.guest_name} — {daysSince(m.last_visit_at)} gün, {m.visit_count} ziyaret</li>
            ))}
          </ul>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="bg-white rounded-2xl shadow border border-slate-200 divide-y divide-slate-100">
          {items.map(m => {
            const d = daysSince(m.last_visit_at);
            return (
              <div key={m.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium text-slate-900">{m.guest_name}</div>
                    {m.guest_phone && <div className="text-xs text-slate-500 mt-0.5">{m.guest_phone}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">{m.visit_count}× · {fmtEur(m.total_spent)}</div>
                    {d != null && <div className="text-xs text-slate-500 mt-0.5">son ziyaret {d} gün önce</div>}
                  </div>
                </div>
                {(m.favorite_items?.length || m.notes) && (
                  <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                    {m.favorite_items && m.favorite_items.length > 0 && (
                      <div>💚 {m.favorite_items.join(", ")}</div>
                    )}
                    {m.notes && <div>📝 {m.notes}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
