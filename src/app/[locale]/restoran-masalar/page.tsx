"use client";

import { useEffect, useState } from "react";
import {
  UtensilsCrossed,
  CircleCheck,
  CircleX,
  Clock,
  Sparkles,
} from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import {
  HeroBanner,
  ListCard,
  Skeleton,
} from "@/tenants/restoran/components/banking";

interface Table {
  id: string;
  label: string;
  capacity: number | null;
  zone: string | null;
  status: string;
  current_check_amount: number | null;
}

type Tone = "amber" | "emerald" | "rose" | "slate";

const STATUS_META: Record<string, { label: string; tone: Tone; Icon: typeof CircleCheck }> = {
  free: { label: "Boş", tone: "emerald", Icon: CircleCheck },
  occupied: { label: "Dolu", tone: "rose", Icon: CircleX },
  reserved: { label: "Rezerve", tone: "amber", Icon: Clock },
  cleaning: { label: "Temizleniyor", tone: "slate", Icon: Sparkles },
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

  const zones: Record<string, Table[]> = {};
  for (const t of items || []) {
    const z = t.zone || "Genel";
    (zones[z] = zones[z] || []).push(t);
  }

  const total = items?.length || 0;
  const free = (items || []).filter((t) => t.status === "free").length;
  const occupied = (items || []).filter((t) => t.status === "occupied").length;

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={UtensilsCrossed}
        title="Masalar"
        subtitle={
          items
            ? `${total} masa · ${free} boş · ${occupied} dolu`
            : "Masalarınız yükleniyor…"
        }
      />

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!items && !error && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="h-16" />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          Henüz masa tanımlanmamış.
        </div>
      )}

      {Object.entries(zones).map(([zone, tables]) => (
        <div key={zone} className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            {zone}
          </div>
          {tables.map((t) => {
            const meta = STATUS_META[t.status] || STATUS_META.free;
            const parts: string[] = [];
            if (t.capacity) parts.push(`${t.capacity} kişilik`);
            if (t.current_check_amount && t.current_check_amount > 0) {
              parts.push(
                `Hesap: €${t.current_check_amount.toLocaleString("tr-NL", { maximumFractionDigits: 0 })}`
              );
            }
            return (
              <ListCard
                key={t.id}
                Icon={meta.Icon}
                title={`Masa ${t.label}`}
                subtitle={parts.length > 0 ? parts.join(" · ") : undefined}
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
