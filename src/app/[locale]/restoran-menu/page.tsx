"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed, Clock, MessageCircle } from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import {
  HeroBanner,
  ListCard,
  Skeleton,
} from "@/tenants/restoran/components/banking";

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
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={UtensilsCrossed}
        title="Menü"
        subtitle={
          items
            ? `${items.length} kalem · ${Object.keys(cats).length} kategori`
            : "Menünüz yükleniyor…"
        }
        ctaLabel="WhatsApp ile düzenle"
        ctaHref={`https://wa.me/31644967207?text=${encodeURIComponent("menukalemleri")}`}
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
          Henüz menü kalemi yok.
        </div>
      )}

      {Object.entries(cats).map(([cat, list]) => (
        <div key={cat} className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            {cat}
          </div>
          {list.map((m) => (
            <ListCard
              key={m.id}
              Icon={m.prep_minutes ? Clock : UtensilsCrossed}
              title={m.name + (m.is_available ? "" : "  (Tükendi)")}
              subtitle={
                m.description
                  ? m.description
                  : m.prep_minutes
                    ? `${m.prep_minutes} dakika hazırlık`
                    : undefined
              }
              rightLabel={fmtEur(m.price)}
              rightTone={m.is_available ? "amber" : "slate"}
            />
          ))}
        </div>
      ))}

      <div className="text-center">
        <a
          href="https://wa.me/31644967207?text=menukalemleri"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition"
        >
          <MessageCircle className="w-3.5 h-3.5" strokeWidth={2.2} />
          Menü WhatsApp&apos;tan eklenir/düzenlenir
        </a>
      </div>
    </div>
  );
}
