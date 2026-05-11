"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface KPIs {
  payment_due_units: number;
  open_complaints: number;
  active_residents: number;
  monthly_dues_collected: number;
  upcoming_events: number;
  active_staff_tasks: number;
}

const KPI_CARDS: Array<{
  key: keyof KPIs;
  label: string;
  icon: string;
  color: string;
  href: (t: string) => string;
  /** Para birimli ise true, yoksa adet sayısı. */
  isCurrency?: boolean;
}> = [
  { key: "payment_due_units",     label: "Ödenmemiş Aidat",  icon: "💸", color: "from-rose-500 to-pink-600",      href: t => `/api/panel/start?cmd=aidat&t=${encodeURIComponent(t)}` },
  { key: "open_complaints",       label: "Açık Şikayet/Arıza", icon: "🔧", color: "from-amber-500 to-orange-600",  href: t => `/api/panel/start?cmd=bakim&t=${encodeURIComponent(t)}` },
  { key: "active_residents",      label: "Aktif Sakin",      icon: "👥", color: "from-cyan-500 to-blue-600",      href: t => `/api/panel/start?cmd=binakodu&t=${encodeURIComponent(t)}` },
  { key: "monthly_dues_collected", label: "Bu Ay Tahsilat (₺)", icon: "💰", color: "from-emerald-500 to-teal-600",  href: t => `/api/panel/start?cmd=gelir_gider&t=${encodeURIComponent(t)}`, isCurrency: true },
  { key: "upcoming_events",       label: "Yaklaşan Etkinlik", icon: "📅", color: "from-violet-500 to-fuchsia-600", href: t => `/api/panel/start?cmd=duyuru&t=${encodeURIComponent(t)}` },
  { key: "active_staff_tasks",    label: "Aktif Personel Görev", icon: "🛠", color: "from-slate-600 to-stone-700", href: t => `/api/panel/start?cmd=menu&t=${encodeURIComponent(t)}` },
];

export default function SiteDashboardPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/site/dashboard?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
      })
      .catch(() => { /* sessizce yut — layout zaten init'i validate etti */ });
  }, [token]);

  function formatValue(card: typeof KPI_CARDS[number], raw: number | string): string {
    if (raw === "—") return "—";
    if (card.isCurrency) {
      const n = typeof raw === "number" ? raw : 0;
      return new Intl.NumberFormat("tr-TR").format(n);
    }
    return String(raw);
  }

  return (
    <div className="space-y-6">
      {/* Hero — siteyönetim cyan/teal teması */}
      <div className="bg-gradient-to-br from-cyan-700 via-teal-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Site Yönetim Paneli</h1>
        <p className="text-cyan-100 text-sm mt-2 leading-relaxed">
          Sakin iletişimi, aidat takibi, şikayet/talep yönetimi — hepsi bir panelde. Sol menüden modüllere ulaşabilirsiniz.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {KPI_CARDS.map((card) => {
          const value = kpis ? (kpis[card.key] ?? 0) : "—";
          const display = formatValue(card, value);
          const href = token ? card.href(token) : "#";
          return (
            <a
              key={card.key}
              href={href}
              className={`block bg-gradient-to-br ${card.color} text-white rounded-2xl p-4 shadow-md hover:shadow-lg active:scale-95 transition`}
            >
              <div className="text-2xl mb-1">{card.icon}</div>
              <div className="text-3xl font-bold leading-none">{display}</div>
              <div className="text-xs opacity-90 mt-1.5">{card.label}</div>
            </a>
          );
        })}
      </div>

      {/* Quick actions hint */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm text-sm text-slate-600 dark:text-slate-400">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">💡 Hızlı işlem</p>
        <p>
          Sakinleri sisteme bağlamak için sol menüden <strong>Sakinler</strong> (bina kodu),
          aidat hatırlatması için <strong>Aidat</strong>, ya da WhatsApp&apos;ta doğrudan komut yazın
          (örn. <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">aidat</span>,{" "}
          <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">bakim</span>,{" "}
          <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">duyuru</span>).
        </p>
      </div>
    </div>
  );
}
