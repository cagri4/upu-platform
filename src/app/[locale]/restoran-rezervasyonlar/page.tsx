"use client";

import { useEffect, useState } from "react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";

interface Reservation {
  id: string;
  guest_name: string;
  guest_phone: string | null;
  party_size: number;
  reserved_at: string;
  table_label: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  loyalty_member_id: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Bekliyor",   cls: "bg-amber-100 text-amber-700" },
  confirmed: { label: "Onaylı",     cls: "bg-emerald-100 text-emerald-700" },
  seated:    { label: "Oturdu",     cls: "bg-sky-100 text-sky-700" },
  completed: { label: "Tamamlandı", cls: "bg-slate-100 text-slate-700" },
  cancelled: { label: "İptal",      cls: "bg-red-100 text-red-700" },
  no_show:   { label: "Gelmedi",    cls: "bg-stone-100 text-stone-700" },
};

export default function ReservationsPage() {
  return (
    <RestoranPanelShell>
      {({ token }) => <List token={token} />}
    </RestoranPanelShell>
  );
}

function List({ token }: { token: string }) {
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/restoran-panel/list?type=reservations&t=${token}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error || "Yüklenemedi."); return; }
        setItems(json.items);
      } catch { setError("Bağlantı hatası."); }
    })();
  }, [token]);

  // Group by day
  const groups: Record<string, Reservation[]> = {};
  for (const r of items || []) {
    const day = r.reserved_at.slice(0, 10);
    (groups[day] = groups[day] || []).push(r);
  }
  const dayLabels: Record<string, string> = {
    [new Date().toISOString().slice(0, 10)]: "Bugün",
    [new Date(Date.now() + 86400000).toISOString().slice(0, 10)]: "Yarın",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-slate-900">📅 Rezervasyonlar</h1>
        <a
          href="https://wa.me/31644967207?text=rezervasyonekle"
          target="_blank" rel="noopener noreferrer"
          className="bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-amber-700 transition"
        >
          ➕ Yeni Ekle
        </a>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>}
      {!items && !error && <div className="text-slate-500">Yükleniyor…</div>}
      {items && items.length === 0 && (
        <div className="bg-white rounded-2xl shadow border border-slate-200 p-8 text-center text-slate-500">
          Bugün ve yarın için rezervasyon yok.
        </div>
      )}

      {Object.keys(groups).sort().map(day => (
        <div key={day} className="mb-6">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {dayLabels[day] || new Date(day).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}
            {" · "}
            {groups[day].length} rezervasyon
          </h2>
          <div className="bg-white rounded-2xl shadow border border-slate-200 divide-y divide-slate-100">
            {groups[day].map(r => {
              const t = new Date(r.reserved_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
              const badge = STATUS_BADGE[r.status] || { label: r.status, cls: "bg-slate-100 text-slate-700" };
              return (
                <div key={r.id} className="p-4 sm:p-5 flex items-start gap-4">
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="text-lg font-bold text-slate-900">{t}</div>
                    {r.table_label && <div className="text-xs text-slate-500 mt-0.5">Masa {r.table_label}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900">{r.guest_name}</span>
                      <span className="text-sm text-slate-500">({r.party_size}p)</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                      {r.loyalty_member_id && <span className="text-xs">💝</span>}
                    </div>
                    {r.guest_phone && <div className="text-xs text-slate-500 mt-0.5">{r.guest_phone}</div>}
                    {r.notes && <div className="text-sm text-slate-600 mt-1">{r.notes}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
