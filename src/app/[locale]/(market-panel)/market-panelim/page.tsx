"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePanelChrome } from "@/components/admin-layout";

interface KPIs {
  daily_revenue: number;
  low_stock_count: number;
  pending_orders: number;
  monthly_suppliers: number;
  active_promotions: number;
  loyalty_members: number;
}

type CardKey = keyof KPIs | "profil";

interface CardDef {
  key: CardKey;
  label: string;
  icon: string;
  color: string;
  href: (t: string) => string;
  format?: (n: number) => string;
  staticValue?: () => string;
}

const CARD_DEFS: CardDef[] = [
  { key: "daily_revenue",     label: "Bugünkü Cironuz",         icon: "💰", color: "from-emerald-500 to-teal-600",  href: t => `/tr/market-kasa-raporu?t=${encodeURIComponent(t)}`,          format: (n) => `${n.toLocaleString("tr-TR")} €` },
  { key: "low_stock_count",   label: "Kritik Stoklarınız",      icon: "📦", color: "from-rose-500 to-pink-600",     href: t => `/tr/market-stok?t=${encodeURIComponent(t)}` },
  { key: "pending_orders",    label: "Bekleyen Siparişleriniz", icon: "📥", color: "from-amber-500 to-orange-600",  href: t => `/tr/market-tedarikci-siparisleri?t=${encodeURIComponent(t)}` },
  { key: "monthly_suppliers", label: "Bu Ay Tedarikçileriniz",  icon: "🚚", color: "from-indigo-500 to-blue-600",   href: t => `/tr/market-tedarikciler?t=${encodeURIComponent(t)}` },
  { key: "active_promotions", label: "Aktif Kampanyalar",       icon: "🎯", color: "from-violet-500 to-fuchsia-600", href: t => `/tr/market-musteri-sadakati?t=${encodeURIComponent(t)}` },
  { key: "loyalty_members",   label: "Sadık Üye Sayınız",       icon: "💛", color: "from-sky-500 to-cyan-600",      href: t => `/tr/market-musteri-sadakati?t=${encodeURIComponent(t)}` },
  { key: "profil",            label: "Profilim",                icon: "👤", color: "from-stone-600 to-stone-800",   href: t => `/tr/market-profilim?t=${encodeURIComponent(t)}`, staticValue: () => "Düzenle" },
];

export default function MarketPanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const { openQrScanner } = usePanelChrome();

  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/market/dashboard?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
      })
      .catch(() => { /* layout zaten init validate etti */ });
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-600 via-orange-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Panelim</h1>
        <p className="text-amber-100 text-sm mt-2 leading-relaxed">
          Sisteminizi buradan yönetin.
        </p>
        <p className="text-amber-200/80 text-xs mt-3 italic">
          Paneldeki kartlara sol menüden de ulaşabilirsiniz.
        </p>
      </div>

      {/* KPI / quick-link grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {CARD_DEFS.map((card) => {
          const value = card.staticValue
            ? card.staticValue()
            : (kpis
              ? (card.format
                ? card.format(kpis[card.key as keyof KPIs])
                : kpis[card.key as keyof KPIs])
              : "—");
          const href = token ? card.href(token) : "#";
          return (
            <a
              key={card.key}
              href={href}
              className={`block bg-gradient-to-br ${card.color} text-white rounded-2xl p-4 shadow-md hover:shadow-lg active:scale-95 transition relative`}
            >
              <div className="text-2xl mb-1">{card.icon}</div>
              <div className="text-2xl sm:text-3xl font-bold leading-none truncate">{value}</div>
              <div className="text-xs opacity-90 mt-1.5">{card.label}</div>
            </a>
          );
        })}
      </div>

      {/* Bilgisayardan Kullan — feature highlight */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="text-3xl flex-shrink-0">🖥</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Bilgisayardan Kullanın</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
              Bilgisayarınızda <span className="font-semibold text-slate-900 dark:text-slate-100">qr.upudev.nl</span> sayfasını açın, telefonunuzdaki QR kodu kameraya tutun — saniyeler içinde panel masaüstünüzde de açılır.
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

      {/* Quick actions hint */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm text-sm text-slate-600 dark:text-slate-400">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">💡 Hızlı işlem</p>
        <p>
          Stok eklemek için sol menüden <strong>Stok</strong>, kasa raporu için <strong>Kasa Raporu</strong>, ya da WhatsApp&apos;ta doğrudan komut adını yazabilirsiniz (örn. <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">stokekle</span>, <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">brifing</span>).
        </p>
      </div>
    </div>
  );
}
