"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface KPIs {
  properties: number;
  customers: number;
  contracts: number;
  presentations: number;
  tracking: number;
  presentations_this_week: number;
}

const KPI_CARDS: Array<{
  key: keyof KPIs;
  label: string;
  icon: string;
  color: string;
  href: (t: string) => string;
}> = [
  { key: "properties",   label: "Mülklerim",           icon: "🏢", color: "from-indigo-500 to-blue-600",       href: t => `/tr/mulklerim?t=${encodeURIComponent(t)}` },
  { key: "customers",    label: "Müşterilerim",        icon: "👥", color: "from-emerald-500 to-teal-600",      href: t => `/tr/musterilerim?t=${encodeURIComponent(t)}` },
  { key: "contracts",    label: "Aktif Sözleşmeler",   icon: "📋", color: "from-amber-500 to-orange-600",      href: t => `/api/panel/start?cmd=sozlesme&t=${encodeURIComponent(t)}` },
  { key: "presentations_this_week", label: "Bu Hafta Sunum", icon: "📊", color: "from-violet-500 to-fuchsia-600", href: t => `/tr/sunumlarim?t=${encodeURIComponent(t)}` },
  { key: "tracking",     label: "Aktif Takip",         icon: "🎯", color: "from-rose-500 to-pink-600",         href: t => `/tr/takip?t=${encodeURIComponent(t)}` },
  { key: "presentations", label: "Toplam Sunum",       icon: "📁", color: "from-slate-600 to-stone-700",       href: t => `/tr/sunumlarim?t=${encodeURIComponent(t)}` },
];

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/panel/dashboard?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
      })
      .catch(() => { /* sessizce yut — layout zaten init'i validate etti */ });
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-emerald-100 text-sm mt-2 leading-relaxed">
          Sistemini buradan yönet. Sol menüden mülklerine, müşterilerine ve diğer modüllere ulaş — kart üzerine tıklayarak ilgili sayfaya git.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {KPI_CARDS.map((card) => {
          const value = kpis ? (kpis[card.key] ?? 0) : "—";
          const href = token ? card.href(token) : "#";
          return (
            <a
              key={card.key}
              href={href}
              className={`block bg-gradient-to-br ${card.color} text-white rounded-2xl p-4 shadow-md hover:shadow-lg active:scale-95 transition`}
            >
              <div className="text-2xl mb-1">{card.icon}</div>
              <div className="text-3xl font-bold leading-none">{value}</div>
              <div className="text-xs opacity-90 mt-1.5">{card.label}</div>
            </a>
          );
        })}
      </div>

      {/* Quick actions hint */}
      <div className="bg-white rounded-2xl p-4 shadow-sm text-sm text-slate-600">
        <p className="font-semibold text-slate-900 mb-2">💡 Hızlı işlem</p>
        <p>
          Yeni mülk eklemek için sol menüden <strong>Mülkler</strong>, müşteri eklemek için <strong>Müşteriler</strong>, ya da WhatsApp&apos;ta doğrudan komut adını yaz (örn. <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">mulkekle</span>).
        </p>
      </div>
    </div>
  );
}
