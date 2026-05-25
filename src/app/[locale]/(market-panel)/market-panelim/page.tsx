"use client";

/**
 * Market Panelim — banking primitive port (bayi pattern paralel).
 *
 * - HeroBanner (üst)
 * - ActionCircle quick-actions row (Stok / Tedarikçi / Sadakat / Kasa / Profil)
 * - StatCard grid (6 KPI)
 * - "Bilgisayardan Kullanın" feature card — mobile only (QR kameraya bağlı)
 * - InfoChip ipucu (WA shortcut)
 *
 * Bayi'deki edit/drag layout MVP'de yok — düz dizilim. Persist gerekirse
 * sonra `/api/market/layout` + DEFAULT_MARKET_QUICK_ACTIONS pattern eklenir.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Store,
  Package,
  Truck,
  Receipt,
  Heart,
  Users,
  Megaphone,
  AlertTriangle,
  ClipboardList,
  Euro,
  User,
  Monitor,
} from "lucide-react";
import { HeroBanner, StatCard, ActionCircle, KvkkConsentModal } from "@/components/banking";
import { usePanelChrome } from "@/components/admin-layout";
import { useIsMobileDevice } from "@/lib/use-is-mobile-device";

interface KPIs {
  daily_revenue: number;
  low_stock_count: number;
  pending_orders: number;
  monthly_suppliers: number;
  active_promotions: number;
  loyalty_members: number;
}

function formatEuro(n: number): string {
  if (!n) return "€0";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}K`;
  return `€${Math.round(n).toLocaleString("tr-TR")}`;
}

export default function MarketPanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";
  const { openQrScanner } = usePanelChrome();
  const isMobileDevice = useIsMobileDevice();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [showKvkkModal, setShowKvkkModal] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/market/dashboard?t=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
      })
      .catch(() => { /* layout zaten init validate etti */ });
  }, [token]);

  // KVKK consent — bayi pattern: localStorage dismissed_today + /api/profile/kvkk-status
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let dismissedToday = false;
    try {
      dismissedToday = window.localStorage.getItem("kvkk_modal_dismissed_today") === today;
    } catch { /* private mode / quota */ }
    if (dismissedToday) return;

    fetch("/api/profile/kvkk-status", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.needsConsent) setShowKvkkModal(true);
      })
      .catch(() => { /* sessiz */ });
  }, []);

  function onKvkkAccepted() {
    setShowKvkkModal(false);
    try { window.localStorage.removeItem("kvkk_modal_dismissed_today"); } catch { /* yut */ }
  }
  function onKvkkDefer() {
    setShowKvkkModal(false);
    const today = new Date().toISOString().slice(0, 10);
    try { window.localStorage.setItem("kvkk_modal_dismissed_today", today); } catch { /* yut */ }
  }

  const q = (path: string) => (token ? `${path}?t=${encodeURIComponent(token)}` : path);
  const num = (k: keyof KPIs): string | number => (kpis ? Number(kpis[k]) || 0 : "—");
  const eur = (k: keyof KPIs): string => (kpis ? formatEuro(Number(kpis[k]) || 0) : "—");

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Store}
        title="Panelim"
        subtitle="Sisteminizi buradan yönetin. Paneldeki kartlara sol menüden de ulaşabilirsiniz."
      />

      {/* Quick actions row */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/70 dark:border-slate-800 shadow-sm">
        <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
          <ActionCircle Icon={Package} label="Stok" href={q("/tr/market-stok")} />
          <ActionCircle Icon={Truck} label="Tedarikçi" href={q("/tr/market-tedarikciler")} />
          <ActionCircle Icon={ClipboardList} label="Siparişler" href={q("/tr/market-tedarikci-siparisleri")} />
          <ActionCircle Icon={Heart} label="Sadakat" href={q("/tr/market-musteri-sadakati")} />
          <ActionCircle Icon={Receipt} label="Kasa" href={q("/tr/market-kasa-raporu")} />
          <ActionCircle Icon={User} label="Profil" href={q("/tr/market-profilim")} />
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <StatCard value={eur("daily_revenue")} label="Bugünkü Cironuz" Icon={Euro} href={q("/tr/market-kasa-raporu")} />
        <StatCard value={num("low_stock_count")} label="Kritik Stoklarınız" Icon={AlertTriangle} href={q("/tr/market-stok")} />
        <StatCard value={num("pending_orders")} label="Bekleyen Siparişleriniz" Icon={ClipboardList} href={q("/tr/market-tedarikci-siparisleri")} />
        <StatCard value={num("monthly_suppliers")} label="Bu Ay Tedarikçileriniz" Icon={Truck} href={q("/tr/market-tedarikciler")} />
        <StatCard value={num("active_promotions")} label="Aktif Kampanyalar" Icon={Megaphone} href={q("/tr/market-musteri-sadakati")} />
        <StatCard value={num("loyalty_members")} label="Sadık Üye Sayınız" Icon={Users} href={q("/tr/market-musteri-sadakati")} />
      </div>

      {/* Bilgisayardan Kullan — feature highlight (mobile only) */}
      {isMobileDevice && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-800 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Monitor className="w-6 h-6" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Bilgisayardan Kullanın</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-3">
                Bilgisayarınızda <span className="font-semibold text-slate-900 dark:text-slate-100">qr.upudev.nl</span> sayfasını açın, telefonunuzdaki QR kodu kameraya tutun — saniyeler içinde panel masaüstünüzde de açılır.
              </p>
              <button
                onClick={openQrScanner}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition active:scale-95"
              >
                Şimdi Bağlan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick hint */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-2xl p-4 text-sm text-slate-700 dark:text-slate-300">
        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1.5">💡 Hızlı işlem</p>
        <p className="leading-relaxed">
          WhatsApp&apos;ta komut adını doğrudan yazabilirsiniz: <span className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-xs">stokekle</span>, <span className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-xs">brifing</span>, <span className="font-mono bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-xs">kasarapor</span>.
        </p>
      </div>

      {showKvkkModal && (
        <KvkkConsentModal
          tenantKey="market"
          onAccepted={onKvkkAccepted}
          onDefer={onKvkkDefer}
        />
      )}
    </div>
  );
}
