"use client";

import { useEffect, useState } from "react";
import { Heart, Cake, Bell } from "lucide-react";
import { RestoranPanelShell } from "@/tenants/restoran/components/panel-shell";
import {
  HeroBanner,
  ListCard,
  Skeleton,
} from "@/tenants/restoran/components/banking";

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
  const birthdaysToday = (items || []).filter((m) => m.birthday === todayMD);
  const dormant = (items || []).filter((m) => {
    const d = daysSince(m.last_visit_at);
    return d != null && d > 14 && m.visit_count >= 5;
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Heart}
        title="Müdavimler"
        subtitle={
          items
            ? `${items.length} üye · toplam ${fmtEur(totalSpent)} harcama`
            : "Müdavim panosu yükleniyor…"
        }
        ctaLabel="WhatsApp üye davet"
        ctaHref="https://wa.me/31644967207?text=sadakat"
      />

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 rounded-2xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!items && !error && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="h-16" />
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          Henüz müdavim yok. WhatsApp&apos;tan <code>uye ol</code> davet linki paylaşabilirsiniz.
        </div>
      )}

      {birthdaysToday.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            🎂 Bugün doğum günü olanlar
          </div>
          {birthdaysToday.map((m) => (
            <ListCard
              key={`bday-${m.id}`}
              Icon={Cake}
              title={m.guest_name}
              subtitle={`${m.visit_count}× ziyaret · ${fmtEur(m.total_spent)} harcama`}
              rightLabel="Bugün"
              rightTone="amber"
            />
          ))}
        </div>
      )}

      {dormant.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            💤 Geri çağırma adayları (2+ hafta yok)
          </div>
          {dormant.slice(0, 5).map((m) => {
            const d = daysSince(m.last_visit_at);
            return (
              <ListCard
                key={`dorm-${m.id}`}
                Icon={Bell}
                title={m.guest_name}
                subtitle={`${d} gün önce · ${m.visit_count} ziyaret · ${fmtEur(m.total_spent)}`}
                rightLabel="Hatırlat"
                rightTone="rose"
              />
            );
          })}
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
            Tüm üyeler
          </div>
          {items.map((m) => {
            const d = daysSince(m.last_visit_at);
            const subParts: string[] = [];
            if (m.guest_phone) subParts.push(m.guest_phone);
            if (d != null) subParts.push(`son ziyaret ${d} gün önce`);
            if (m.favorite_items && m.favorite_items.length > 0) {
              subParts.push(`💚 ${m.favorite_items.slice(0, 2).join(", ")}`);
            }
            return (
              <ListCard
                key={m.id}
                Icon={Heart}
                title={m.guest_name}
                subtitle={subParts.length > 0 ? subParts.join(" · ") : undefined}
                rightLabel={`${m.visit_count}× · ${fmtEur(m.total_spent)}`}
                rightTone="amber"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
