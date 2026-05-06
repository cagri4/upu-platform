"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminLayout } from "@/components/admin-layout";

type Status = "loading" | "ready" | "error";

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

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [officeName, setOfficeName] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("Link geçersiz."); return; }
    Promise.all([
      fetch(`/api/panel/init?t=${encodeURIComponent(token)}`).then(r => r.json()),
      fetch(`/api/panel/dashboard?t=${encodeURIComponent(token)}`).then(r => r.json()),
    ])
      .then(([init, dash]) => {
        if (init?.error) { setStatus("error"); setError(init.error); return; }
        if (dash?.error) { setStatus("error"); setError(dash.error); return; }
        setDisplayName(init.displayName);
        setOfficeName(init.officeName);
        setKpis(dash.kpis);
        setStatus("ready");
      })
      .catch(() => { setStatus("error"); setError("Bağlantı hatası."); });
  }, [token]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-4xl">⏳</div></div>;
  }
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Hata</h1>
          <p className="text-slate-600 text-sm mb-4">{error}</p>
          <a href="https://wa.me/31644967207" className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg">
            WhatsApp&apos;a dön
          </a>
        </div>
      </div>
    );
  }

  const firstName = (displayName || "").split(/\s+/)[0] || "";

  return (
    <AdminLayout
      token={token}
      displayName={displayName}
      officeName={officeName}
      activeItem="dashboard"
    >
      <div className="space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold">
            Hoşgeldin{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="text-emerald-100 text-sm mt-2 leading-relaxed">
            Sistemini buradan yönet. Sol menüden mülklerine, müşterilerine ve diğer modüllere ulaş — kart üzerine tıklayarak ilgili sayfaya git.
          </p>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {KPI_CARDS.map((card) => {
            const value = kpis?.[card.key] ?? 0;
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
    </AdminLayout>
  );
}
