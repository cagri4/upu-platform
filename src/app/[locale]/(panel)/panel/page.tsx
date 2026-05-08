"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface KPIs {
  properties: number;
  customers: number;
  contracts: number;
  presentations: number;
  tracking: number;
}

type CardKey = keyof KPIs | "takvim" | "profil" | "websitem";

interface CardDef {
  key: CardKey;
  label: string;
  icon: string;
  color: string;
  /** Token + opsiyonel webSlug ile href üretir. */
  href: (t: string, slug: string | null) => string;
  /** "Yakında" badge — placeholder kart. */
  comingSoon?: boolean;
  /** KPI sayı yerine "Aktif" / "—" gibi sabit metin. */
  staticValue?: (slug: string | null) => string | number;
}

const CARD_DEFS: CardDef[] = [
  { key: "properties",   label: "Mülklerim",         icon: "🏢", color: "from-indigo-500 to-blue-600",       href: t => `/tr/mulklerim?t=${encodeURIComponent(t)}` },
  { key: "customers",    label: "Müşterilerim",      icon: "👥", color: "from-emerald-500 to-teal-600",      href: t => `/tr/musterilerim?t=${encodeURIComponent(t)}` },
  { key: "contracts",    label: "Sözleşmeler",       icon: "📋", color: "from-amber-500 to-orange-600",      href: t => `/tr/sozlesmelerim?t=${encodeURIComponent(t)}` },
  { key: "tracking",     label: "Takiplerim",        icon: "🎯", color: "from-rose-500 to-pink-600",         href: t => `/tr/takip?t=${encodeURIComponent(t)}` },
  { key: "presentations", label: "Sunumlarım",       icon: "📊", color: "from-violet-500 to-fuchsia-600",    href: t => `/tr/sunumlarim?t=${encodeURIComponent(t)}` },
  { key: "takvim",       label: "Takvim",            icon: "📅", color: "from-sky-500 to-cyan-600",          href: t => `/tr/takvim?t=${encodeURIComponent(t)}`,  comingSoon: true,  staticValue: () => "Yakında" },
  { key: "profil",       label: "Profilim",          icon: "👤", color: "from-stone-600 to-stone-800",       href: t => `/tr/profil-duzenle?t=${encodeURIComponent(t)}`, staticValue: () => "Düzenle" },
  { key: "websitem",     label: "Web Sitem",         icon: "🌐", color: "from-teal-500 to-emerald-700",      href: (t, slug) => slug ? `/u/${slug}` : `/api/panel/web-sitem?t=${encodeURIComponent(t)}`, staticValue: (slug) => slug ? "Aktif" : "Kur" },
];

export default function PanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [webSlug, setWebSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/panel/dashboard?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error) {
          if (d?.kpis) setKpis(d.kpis);
          if (d?.webSlug) setWebSlug(d.webSlug);
        }
      })
      .catch(() => { /* sessizce yut — layout zaten init'i validate etti */ });
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Panelim</h1>
        <p className="text-emerald-100 text-sm mt-2 leading-relaxed">
          Sisteminizi buradan yönetin.
        </p>
        <p className="text-emerald-200/80 text-xs mt-3 italic">
          Paneldeki kartlara sol menüden de ulaşabilirsiniz.
        </p>
      </div>

      {/* KPI / quick-link grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {CARD_DEFS.map((card) => {
          const value = card.staticValue
            ? card.staticValue(webSlug)
            : (kpis ? (kpis[card.key as keyof KPIs] ?? 0) : "—");
          const href = token ? card.href(token, webSlug) : "#";
          return (
            <a
              key={card.key}
              href={href}
              className={`block bg-gradient-to-br ${card.color} text-white rounded-2xl p-4 shadow-md hover:shadow-lg active:scale-95 transition relative`}
            >
              {card.comingSoon && (
                <span className="absolute top-2 right-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                  Yakında
                </span>
              )}
              <div className="text-2xl mb-1">{card.icon}</div>
              <div className="text-2xl sm:text-3xl font-bold leading-none truncate">{value}</div>
              <div className="text-xs opacity-90 mt-1.5">{card.label}</div>
            </a>
          );
        })}
      </div>

      {/* Quick actions hint */}
      <div className="bg-white rounded-2xl p-4 shadow-sm text-sm text-slate-600">
        <p className="font-semibold text-slate-900 mb-2">💡 Hızlı işlem</p>
        <p>
          Yeni mülk eklemek için sol menüden <strong>Mülklerim</strong>, müşteri eklemek için <strong>Müşterilerim</strong>, ya da WhatsApp&apos;ta doğrudan komut adını yazabilirsiniz (örn. <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">mulkekle</span>).
        </p>
      </div>
    </div>
  );
}
