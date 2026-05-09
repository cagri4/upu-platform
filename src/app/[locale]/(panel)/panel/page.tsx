"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePanelChrome } from "@/components/admin-layout";
import { ViewDensityToggle, useViewDensity } from "@/components/view-density-toggle";
import { PwaInstallCard } from "@/components/pwa-install-card";

interface KPIs {
  properties: number;
  customers: number;
  contracts: number;
  presentations: number;
  tracking: number;
  calendar: number;
}

type CardKey = keyof KPIs | "profil" | "websitem";

interface CardDef {
  key: CardKey;
  label: string;
  icon: string;
  iconSrc?: string;
  color: string;
  /** Token + opsiyonel webSlug ile href üretir. */
  href: (t: string, slug: string | null) => string;
  /** "Yakında" badge — placeholder kart. */
  comingSoon?: boolean;
  /** KPI sayı yerine "Aktif" / "—" gibi sabit metin. */
  staticValue?: (slug: string | null) => string | number;
}

const CARD_DEFS: CardDef[] = [
  { key: "properties",   label: "Mülklerim",   icon: "🏢", iconSrc: "/icons/emlak/mulkler.png",    color: "from-indigo-500 to-blue-600",    href: t => `/tr/mulklerim?t=${encodeURIComponent(t)}` },
  { key: "customers",    label: "Müşterilerim", icon: "👥", iconSrc: "/icons/emlak/musteriler.png", color: "from-emerald-500 to-teal-600",   href: t => `/tr/musterilerim?t=${encodeURIComponent(t)}` },
  { key: "contracts",    label: "Sözleşmeler", icon: "📋", iconSrc: "/icons/emlak/sozlesme.png",   color: "from-amber-500 to-orange-600",   href: t => `/tr/sozlesmelerim?t=${encodeURIComponent(t)}` },
  { key: "tracking",     label: "Takiplerim",  icon: "🎯", iconSrc: "/icons/emlak/takip.png",      color: "from-rose-500 to-pink-600",      href: t => `/tr/takip?t=${encodeURIComponent(t)}` },
  { key: "presentations", label: "Sunumlarım", icon: "📊", iconSrc: "/icons/emlak/sunumlar.png",   color: "from-violet-500 to-fuchsia-600", href: t => `/tr/sunumlarim?t=${encodeURIComponent(t)}` },
  { key: "calendar",     label: "Takvim",      icon: "📅", iconSrc: "/icons/emlak/takvim.png",     color: "from-sky-500 to-cyan-600",       href: t => `/tr/takvim?t=${encodeURIComponent(t)}` },
  { key: "profil",       label: "Profilim",    icon: "👤", iconSrc: "/icons/emlak/profil.png",     color: "from-stone-600 to-stone-800",    href: t => `/tr/profil-duzenle?t=${encodeURIComponent(t)}`, staticValue: () => "Düzenle" },
  { key: "websitem",     label: "Web Sitem",   icon: "🌐", iconSrc: "/icons/emlak/websitem.png",   color: "from-teal-500 to-emerald-700",   href: (t, slug) => slug ? `/u/${slug}` : `/api/panel/web-sitem?t=${encodeURIComponent(t)}`, staticValue: (slug) => slug ? "Aktif" : "Kur" },
];

export default function PanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const { openQrScanner } = usePanelChrome();
  const { view, columns, setView, setColumns, gridClasses } = useViewDensity("emlak-panelim");

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

      {/* View density toggle */}
      <div className="flex justify-end">
        <ViewDensityToggle
          view={view}
          columns={columns}
          onViewChange={setView}
          onColumnsChange={setColumns}
        />
      </div>

      {/* KPI / quick-link grid — yoğunluğa göre adapte */}
      <div className={gridClasses}>
        {CARD_DEFS.map((card) => {
          const value = card.staticValue
            ? card.staticValue(webSlug)
            : (kpis ? (kpis[card.key as keyof KPIs] ?? 0) : "—");
          const href = token ? card.href(token, webSlug) : "#";
          const compact = columns >= 3;
          const mini = columns === 4;
          return (
            <a
              key={card.key}
              href={href}
              className={`block bg-gradient-to-br ${card.color} text-white rounded-2xl shadow-md hover:shadow-lg active:scale-95 transition relative ${
                mini ? "p-2" : compact ? "p-3" : "p-4"
              }`}
            >
              {card.comingSoon && (
                <span className={`absolute right-1.5 ${mini ? "top-1 text-[9px] px-1" : "top-2 text-[10px] px-1.5 py-0.5"} bg-white/20 rounded-full uppercase tracking-wide`}>
                  Yakında
                </span>
              )}
              {card.iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.iconSrc}
                  alt=""
                  className={`${mini ? "w-6 h-6 mb-0.5" : compact ? "w-8 h-8 mb-1" : "w-10 h-10 mb-1.5"} drop-shadow-sm`}
                />
              ) : (
                <div className={mini ? "text-base mb-0.5" : compact ? "text-xl mb-0.5" : "text-2xl mb-1"}>{card.icon}</div>
              )}
              <div className={`font-bold leading-none truncate ${
                mini ? "text-base" : compact ? "text-xl" : "text-2xl sm:text-3xl"
              }`}>{value}</div>
              <div className={`opacity-90 ${mini ? "text-[10px] mt-0.5" : compact ? "text-[11px] mt-1" : "text-xs mt-1.5"}`}>{card.label}</div>
            </a>
          );
        })}
      </div>

      {/* PWA Install — mobile only, standalone'da gizlenir */}
      <PwaInstallCard />

      {/* Bilgisayardan Kullan — feature highlight */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="text-3xl flex-shrink-0">🖥</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 mb-1">Bilgisayardan Kullanın</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Bilgisayarınızda <span className="font-semibold text-slate-900">qr.upudev.nl</span> sayfasını açın, telefonunuzdaki QR kodu kameraya tutun — saniyeler içinde panel masaüstünüzde de açılır.
            </p>
            <button
              onClick={openQrScanner}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              🖥 Şimdi Bağlan
            </button>
          </div>
        </div>
      </div>

      {/* İpucu — killer özellikler kısa anlatım */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-lg">💡</span> İpucu
        </p>
        <ul className="space-y-3 text-sm">
          <li>
            <p className="font-semibold text-slate-900">🎯 Takiplerim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Kart ekle, her sabah Bodrum&apos;daki yeni sahibi ilanları WhatsApp&apos;ınıza gelir.
            </p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">🤖 Mülklerim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Mülk ekledikçe AI saniyelerde profesyonel sunum hazırlar.
            </p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">📋 Sözleşmelerim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Mülk + müşteri seç, AI hukuki taslak metni üretir, paylaşılabilir link ile imzalanır.
            </p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">🌐 Profilim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Bilgileriniz kişisel web sayfanıza otomatik yansır, müşterilere paylaşın.
            </p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">📅 Takvim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Tarih ve saat girerek hatırlatıcı kurun, WhatsApp&apos;ınıza zamanı geldiğinde gönderirim.
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}
