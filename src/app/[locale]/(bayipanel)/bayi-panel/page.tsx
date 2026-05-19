"use client";

/**
 * Bayi Panelim — banking primitives refactor (Sprint B-1).
 *
 * Pattern: emlak (panel)/panel/page.tsx ile aynı görsel dil.
 *   - HeroBanner üst
 *   - Profile completeness ListCard (firma_profili eksikse)
 *   - 6 KPI StatCard grid (toplam_bayi, aktif_siparis, bekleyen_tahsilat,
 *     bu_ay_ciro, kritik_stok, davet_aktif)
 *   - 6 ActionCircle quick action row
 *   - Skeleton loading
 *
 * KVKK consent modal Sprint A'da bayi panel'e mount edildi — korunuyor.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  ClipboardList,
  TrendingDown,
  TrendingUp,
  PackageX,
  Mail,
  ClipboardCheck,
  Sparkles,
  Settings,
  Bell,
} from "lucide-react";
import {
  HeroBanner,
  StatCard,
  ActionCircle,
  ListCard,
  Skeleton,
  KvkkConsentModal,
} from "@/components/banking";
import { BAYI_QUICK_ACTIONS } from "@/platform/quick-actions/bayi-catalog";
import { DEFAULT_BAYI_QUICK_ACTIONS, type BayiQuickActionKey } from "@/platform/quick-actions/bayi-keys";

interface KPIs {
  dealer_count: number;
  active_orders: number;
  pending_invoices: number;
  overdue_amount: number;
  month_revenue: number;
  critical_stock: number;
  active_invites: number;
}

function formatCurrency(n: number): string {
  if (!n) return "₺0";
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${Math.round(n / 1_000)}K`;
  return `₺${Math.round(n).toLocaleString("tr-TR")}`;
}

export default function BayiPanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [quickActions, setQuickActions] = useState<BayiQuickActionKey[]>(DEFAULT_BAYI_QUICK_ACTIONS);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [showKvkkModal, setShowKvkkModal] = useState(false);

  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bayi-panel/dashboard${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
        if (Array.isArray(d?.quickActions) && d.quickActions.length > 0) {
          setQuickActions(d.quickActions as BayiQuickActionKey[]);
        }
      })
      .catch(() => { /* layout init zaten validate etti */ })
      .finally(() => setKpisLoading(false));
  }, [token]);

  // Profile completeness — firma_profili.ticari_unvan eksikse banner
  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/bayi-panel/profile${qs}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const unvan = d?.firma?.ticari_unvan;
        if (!unvan || String(unvan).trim().length === 0) {
          setProfileIncomplete(true);
        }
      })
      .catch(() => { /* sessiz */ });
  }, [token]);

  // KVKK consent modal — Sprint A pattern
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
  const kpiValue = (k: keyof KPIs): string | number => (kpis ? kpis[k] ?? 0 : "—");
  const kpiCurrency = (k: keyof KPIs): string => (kpis ? formatCurrency(kpis[k] ?? 0) : "—");

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* HeroBanner */}
      <HeroBanner
        Icon={Sparkles}
        title="Bayi Yönetim Paneli"
        subtitle="Bayilerinizi, siparişleri ve tahsilatları tek yerden takip edin."
      />

      {/* Profile completeness — firma_profili eksikse */}
      {profileIncomplete && (
        <ListCard
          Icon={ClipboardCheck}
          title="Profilinizi Tamamlayın"
          subtitle="Firma adı, vergi no, IBAN, brifing tercihi — ~5 dakika"
          rightLabel="Doldur"
          href={q("/tr/bayi-profil")}
        />
      )}

      {/* Quick actions — kullanıcı seçimine göre dinamik render */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Hızlı işlem
          </div>
          <a
            href={q("/tr/bayi-panel-ayarlari")}
            className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
          >
            <Settings className="w-3 h-3" strokeWidth={2.2} />
            Düzenle
          </a>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {quickActions.map((key) => {
            const def = BAYI_QUICK_ACTIONS[key];
            if (!def) return null;
            return (
              <ActionCircle
                key={key}
                Icon={def.Icon}
                label={def.label}
                href={def.hrefFor(token)}
              />
            );
          })}
        </div>
      </div>

      {/* KPI grid — 2 mobile, 3 desktop */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            Icon={Building2}
            value={kpiValue("dealer_count")}
            label="Toplam Bayi"
            href={q("/tr/bayiler")}
          />
          <StatCard
            Icon={ClipboardList}
            value={kpiValue("active_orders")}
            label="Aktif Sipariş"
            href={q("/tr/bayi-siparislerim")}
          />
          <StatCard
            Icon={TrendingDown}
            value={kpiCurrency("overdue_amount")}
            label="Bekleyen Tahsilat"
            href={q("/tr/bayi-tahsilatlarim")}
          />
          <StatCard
            Icon={TrendingUp}
            value={kpiCurrency("month_revenue")}
            label="Bu Ay Ciro"
            href={q("/tr/bayi-raporlar")}
          />
          <StatCard
            Icon={PackageX}
            value={kpiValue("critical_stock")}
            label="Kritik Stok"
            href={q("/tr/bayiler")}
          />
          <StatCard
            Icon={Mail}
            value={kpiValue("active_invites")}
            label="Aktif Davet"
            href={q("/tr/bayiler")}
          />
        </div>
      )}

      {/* Hesap & ayarlar — emlak pattern paralel */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Hesap & ayarlar
        </div>
        <ListCard
          Icon={ClipboardCheck}
          title="Profilim"
          subtitle="Firma ve hesap bilgilerinizi düzenleyin"
          rightLabel="Düzenle"
          href={q("/tr/bayi-profilim")}
        />
        <ListCard
          Icon={Bell}
          title="Panel Ayarları"
          subtitle="Gizlilik, veri export, KVKK"
          rightLabel="Aç"
          href={q("/tr/bayi-panel-ayarlari")}
        />
      </div>

      {showKvkkModal && (
        <KvkkConsentModal
          tenantKey="bayi"
          onAccepted={onKvkkAccepted}
          onDefer={onKvkkDefer}
        />
      )}
    </div>
  );
}
