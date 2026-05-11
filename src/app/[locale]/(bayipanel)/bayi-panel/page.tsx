"use client";

/**
 * Bayi Panelim — 6 KPI dashboard.
 *
 * Pattern: emlak (panel)/panel/page.tsx — gradient hero + KPI grid +
 * "Hızlı işlem" altı.
 *
 * KPI'lar (sektörel):
 *   - dealer_count          Toplam Bayi
 *   - active_orders         Aktif Sipariş
 *   - pending_invoices      Bekleyen Fatura
 *   - overdue_amount        Vadesi Geçmiş Tutar (₺)
 *   - month_revenue         Bu Ay Ciro (₺)
 *   - critical_stock        Kritik Stok (kalem)
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePanelChrome } from "@/components/admin-layout";

interface KPIs {
  dealer_count: number;
  active_orders: number;
  pending_invoices: number;
  overdue_amount: number;
  month_revenue: number;
  critical_stock: number;
}

type CardKey = keyof KPIs | "profil";

interface CardDef {
  key: CardKey;
  label: string;
  icon: string;
  color: string;
  href: (t: string) => string;
  /** KPI değil sabit metin gösteren kart (örn Profilim → "Düzenle"). */
  staticValue?: string;
  /** Tutar formatlama — overdue/revenue için ₺. */
  isCurrency?: boolean;
  comingSoon?: boolean;
}

const CARD_DEFS: CardDef[] = [
  { key: "dealer_count",     label: "Toplam Bayi",     icon: "🏢", color: "from-indigo-500 to-sky-600",     href: t => `/tr/bayi-bayilerim?t=${encodeURIComponent(t)}` },
  { key: "active_orders",    label: "Aktif Sipariş",   icon: "📋", color: "from-emerald-500 to-teal-600",   href: t => `/tr/bayi-siparislerim?t=${encodeURIComponent(t)}` },
  { key: "pending_invoices", label: "Bekleyen Fatura", icon: "📄", color: "from-amber-500 to-orange-600",   href: t => `/tr/bayi-tahsilatlarim?t=${encodeURIComponent(t)}` },
  { key: "overdue_amount",   label: "Vadesi Geçmiş",   icon: "⏰", color: "from-rose-500 to-pink-600",      href: t => `/tr/bayi-vade-hatirlatma?t=${encodeURIComponent(t)}`, isCurrency: true },
  { key: "month_revenue",    label: "Bu Ay Ciro",      icon: "📊", color: "from-violet-500 to-fuchsia-600", href: t => `/tr/bayi-raporlar?t=${encodeURIComponent(t)}`,        isCurrency: true },
  { key: "critical_stock",   label: "Kritik Stok",     icon: "📦", color: "from-stone-600 to-stone-800",    href: t => `/tr/bayi-bayilerim?t=${encodeURIComponent(t)}` },
];

function formatCurrency(n: number): string {
  if (!n) return "₺0";
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${Math.round(n / 1_000)}K`;
  return `₺${Math.round(n).toLocaleString("tr-TR")}`;
}

export default function BayiPanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const { openQrScanner } = usePanelChrome();

  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/bayi-panel/dashboard?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
      })
      .catch(() => { /* layout init zaten validate etti */ });
  }, [token]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-700 via-sky-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Panelim</h1>
        <p className="text-indigo-100 text-sm mt-2 leading-relaxed">
          Sisteminizi buradan yönetin.
        </p>
        <p className="text-indigo-200/80 text-xs mt-3 italic">
          Paneldeki kartlara sol menüden de ulaşabilirsiniz.
        </p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        {CARD_DEFS.map((card) => {
          const raw = kpis ? (kpis[card.key as keyof KPIs] ?? 0) : null;
          const value = card.staticValue
            ? card.staticValue
            : raw === null
            ? "—"
            : card.isCurrency
            ? formatCurrency(raw)
            : raw.toLocaleString("tr-TR");
          const href = token ? card.href(token) : "#";
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
          Yeni bayi eklemek için sol menüden <strong>Bayilerim</strong>, sipariş kaydetmek için <strong>Siparişlerim</strong>, ya da WhatsApp&apos;ta doğrudan komut adını yazabilirsiniz (örn. <span className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">bayilerim</span>).
        </p>
      </div>
    </div>
  );
}
