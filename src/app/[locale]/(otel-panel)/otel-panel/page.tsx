"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePanelChrome } from "@/components/admin-layout";

interface KPIs {
  occupancy_pct: number;
  reservations_week: number;
  today_checkin: number;
  today_checkout: number;
  monthly_revenue: number;
  precheckin_pending: number;
}

const KPI_CARDS: Array<{
  key: keyof KPIs;
  label: string;
  icon: string;
  color: string;
  href: (t: string) => string;
  format?: "pct" | "currency" | "count";
}> = [
  { key: "occupancy_pct",      label: "Bugün Doluluk",        icon: "📊", color: "from-rose-500 to-pink-600",       href: t => `/tr/otel-odalar?t=${encodeURIComponent(t)}`,         format: "pct" },
  { key: "reservations_week",  label: "Bu Hafta Rezervasyon", icon: "📅", color: "from-amber-500 to-orange-600",    href: t => `/tr/otel-rezervasyonlar?t=${encodeURIComponent(t)}`, format: "count" },
  { key: "today_checkin",      label: "Bugün Çek-in",         icon: "🛎",  color: "from-emerald-500 to-teal-600",    href: t => `/tr/otel-rezervasyonlar?t=${encodeURIComponent(t)}`, format: "count" },
  { key: "today_checkout",     label: "Bugün Çek-out",        icon: "🚪", color: "from-cyan-500 to-blue-600",       href: t => `/tr/otel-rezervasyonlar?t=${encodeURIComponent(t)}`, format: "count" },
  { key: "monthly_revenue",    label: "Bu Ay Gelir",          icon: "💰", color: "from-violet-500 to-fuchsia-600",  href: t => `/tr/otel-rezervasyonlar?t=${encodeURIComponent(t)}`, format: "currency" },
  { key: "precheckin_pending", label: "Online Çek-in Eksik",  icon: "📝", color: "from-slate-600 to-stone-700",     href: t => `/tr/otel-rezervasyonlar?t=${encodeURIComponent(t)}`, format: "count" },
];

function formatValue(v: number | undefined, fmt?: "pct" | "currency" | "count"): string {
  if (v === undefined) return "—";
  if (fmt === "pct") return `${v}%`;
  if (fmt === "currency") return `${v.toLocaleString("tr-TR")} ₺`;
  return v.toString();
}

export default function OtelDashboardPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const { openQrScanner } = usePanelChrome();

  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/otel-panel/dashboard?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
      })
      .catch(() => { /* layout init zaten validate etti */ });
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-rose-700 via-amber-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-rose-100 text-sm mt-2 leading-relaxed">
          Otel ön-büronuzun özeti. Sol menüden rezervasyonlarınıza, müşterilerinize ve odalarınıza ulaşın — kart üzerine tıklayarak ilgili sayfaya geçin.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {KPI_CARDS.map((card) => {
          const value = kpis ? formatValue(kpis[card.key], card.format) : "—";
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

      {/* Quick actions hint */}
      <div className="bg-white rounded-2xl p-4 shadow-sm text-sm text-slate-600">
        <p className="font-semibold text-slate-900 mb-2">💡 Hızlı işlem</p>
        <p>
          Yeni rezervasyon eklemek için WhatsApp&apos;ta <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">rezervasyonekle</span> yazın, ya da telefon eden misafirin bilgilerini WA üzerinden tek seferde sisteme alın. Misafir geldiğinde online çek-in eksikse <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">cekinlink</span> komutuyla anında link gönderebilirsiniz.
        </p>
      </div>
    </div>
  );
}
