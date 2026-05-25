"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Heart, Phone } from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import {
  HeroBanner,
  ListCard,
  Skeleton,
} from "@/tenants/restoran/components/banking";

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

type Tone = "amber" | "emerald" | "rose" | "slate";

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Bekliyor", tone: "amber" },
  confirmed: { label: "Onaylı", tone: "emerald" },
  seated: { label: "Oturdu", tone: "emerald" },
  completed: { label: "Tamamlandı", tone: "slate" },
  cancelled: { label: "İptal", tone: "rose" },
  no_show: { label: "Gelmedi", tone: "rose" },
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

  const groups: Record<string, Reservation[]> = {};
  for (const r of items || []) {
    const day = r.reserved_at.slice(0, 10);
    (groups[day] = groups[day] || []).push(r);
  }
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dayLabels: Record<string, string> = {
    [today]: "Bugün",
    [tomorrow]: "Yarın",
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={CalendarDays}
        title="Rezervasyonlar"
        subtitle={
          items
            ? `${items.length} rezervasyon · bugün + yarın`
            : "Rezervasyonlar yükleniyor…"
        }
        ctaLabel="WhatsApp ile yeni ekle"
        ctaHref="https://wa.me/31644967207?text=rezervasyonekle"
      />

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!items && !error && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="h-16" />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          Bugün ve yarın için rezervasyon yok.
        </div>
      )}

      {Object.keys(groups)
        .sort()
        .map((day) => (
          <div key={day} className="space-y-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
              {dayLabels[day] ||
                new Date(day).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  weekday: "long",
                })}
              {" · "}
              {groups[day].length} rezervasyon
            </div>
            {groups[day].map((r) => {
              const t = new Date(r.reserved_at).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const meta = STATUS_META[r.status] || { label: r.status, tone: "slate" as Tone };
              const subParts: string[] = [];
              subParts.push(`${t}`);
              subParts.push(`${r.party_size} kişi`);
              if (r.table_label) subParts.push(`Masa ${r.table_label}`);
              if (r.guest_phone) subParts.push(r.guest_phone);
              return (
                <ListCard
                  key={r.id}
                  Icon={r.loyalty_member_id ? Heart : r.guest_phone ? Phone : CalendarDays}
                  title={r.guest_name + (r.loyalty_member_id ? "  💝" : "")}
                  subtitle={
                    r.notes
                      ? `${subParts.join(" · ")} — ${r.notes}`
                      : subParts.join(" · ")
                  }
                  rightLabel={meta.label}
                  rightTone={meta.tone}
                />
              );
            })}
          </div>
        ))}
    </div>
  );
}
