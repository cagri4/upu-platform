"use client";

/**
 * Site Yönetim Paneli — banking primitives + in-place edit (bayi paterni port).
 *
 * Pattern: bayi (bayipanel)/bayi-panel/page.tsx ile aynı görsel dil + Düzenle/Bitti
 * toggle. Edit mode'da Quick Actions + KPI grid jiggle + ✕ overlay,
 * "+ Ekle" placeholder catalog'da kalan item'lar için.
 *
 * Layout persist: /api/site/layout (GET/PATCH) →
 * metadata.site_panel_layout = { quick_actions, kpi_cards }.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Pencil,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import {
  HeroBanner,
  StatCard,
  ActionCircle,
  ListCard,
  Skeleton,
  KvkkConsentModal,
} from "@/components/banking";
import {
  SITE_QUICK_ACTIONS,
  type SiteQuickActionDef,
} from "@/platform/quick-actions/site-catalog";
import {
  ALL_SITE_QUICK_ACTION_KEYS,
  DEFAULT_SITE_QUICK_ACTIONS,
  type SiteQuickActionKey,
} from "@/platform/quick-actions/site-keys";
import {
  SITE_KPI_CARDS,
  type SiteKpiCardDef,
} from "@/platform/kpi-cards/site-catalog";
import {
  ALL_SITE_KPI_CARD_KEYS,
  DEFAULT_SITE_KPI_CARDS,
  type SiteKpiCardKey,
} from "@/platform/kpi-cards/site-keys";
import { ItemAddModal } from "@/components/panel-edit/item-add-modal";

interface KPIs {
  payment_due_units: number;
  open_complaints: number;
  active_residents: number;
  monthly_dues_collected: number;
  total_units: number;
  overdue_amount: number;
  occupancy_rate: number;
}

function formatCurrency(n: number): string {
  if (!n) return "₺0";
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${Math.round(n / 1_000)}K`;
  return `₺${Math.round(n).toLocaleString("tr-TR")}`;
}

export default function SiteDashboardPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [showKvkkModal, setShowKvkkModal] = useState(false);

  const [quickActions, setQuickActions] = useState<SiteQuickActionKey[] | null>(null);
  const [kpiCards, setKpiCards] = useState<SiteKpiCardKey[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addModalKind, setAddModalKind] = useState<"quick" | "kpi" | null>(null);

  // KPI dashboard
  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/site/dashboard${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
      })
      .catch(() => { /* layout init zaten validate etti */ })
      .finally(() => setKpisLoading(false));
  }, [token]);

  // Layout fetch — single source of truth
  useEffect(() => {
    fetch("/api/site/layout", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (Array.isArray(d?.quick_actions)) setQuickActions(d.quick_actions);
        if (Array.isArray(d?.kpi_cards)) setKpiCards(d.kpi_cards);
      })
      .catch(() => { /* default kalır */ });
  }, []);

  // KVKK
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let dismissedToday = false;
    try {
      dismissedToday = window.localStorage.getItem("kvkk_modal_dismissed_today") === today;
    } catch { /* private mode */ }
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

  async function patchLayout(updates: {
    quick_actions?: SiteQuickActionKey[];
    kpi_cards?: SiteKpiCardKey[];
  }) {
    try {
      await fetch("/api/site/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(updates),
      });
    } catch { /* optimistic — bir sonraki toggle retry */ }
  }

  const currentQuickActions: SiteQuickActionKey[] = quickActions ?? DEFAULT_SITE_QUICK_ACTIONS;
  const currentKpiCards: SiteKpiCardKey[] = kpiCards ?? DEFAULT_SITE_KPI_CARDS;

  function hideQuickAction(key: SiteQuickActionKey) {
    const next = currentQuickActions.filter((k) => k !== key);
    setQuickActions(next);
    void patchLayout({ quick_actions: next });
  }
  function hideKpiCard(key: SiteKpiCardKey) {
    const next = currentKpiCards.filter((k) => k !== key);
    setKpiCards(next);
    void patchLayout({ kpi_cards: next });
  }
  function toggleQuickAction(key: SiteQuickActionKey) {
    const has = currentQuickActions.includes(key);
    const next = has
      ? currentQuickActions.filter((k) => k !== key)
      : [...currentQuickActions, key];
    setQuickActions(next);
    void patchLayout({ quick_actions: next });
  }
  function toggleKpiCard(key: SiteKpiCardKey) {
    const has = currentKpiCards.includes(key);
    const next = has
      ? currentKpiCards.filter((k) => k !== key)
      : [...currentKpiCards, key];
    setKpiCards(next);
    void patchLayout({ kpi_cards: next });
  }

  const q = (path: string) => (token ? `${path}?t=${encodeURIComponent(token)}` : path);
  const kpiDisplay = (def: SiteKpiCardDef): string | number => {
    if (!kpis) return "—";
    const v = kpis[def.key];
    if (def.currency) return formatCurrency(Number(v) || 0);
    if (def.percent) return `${Number(v) || 0}%`;
    return Number(v) || 0;
  };

  const quickActionItems: SiteQuickActionDef[] = currentQuickActions
    .map((k) => SITE_QUICK_ACTIONS[k])
    .filter((x): x is SiteQuickActionDef => Boolean(x));
  const kpiItems: SiteKpiCardDef[] = currentKpiCards
    .map((k) => SITE_KPI_CARDS[k])
    .filter((x): x is SiteKpiCardDef => Boolean(x));

  return (
    <div className="space-y-5 sm:space-y-6">
      <HeroBanner
        Icon={Sparkles}
        title="Site Yönetim Paneli"
        subtitle="Sakin iletişimi, aidat tahsilatı, şikayet ve duyurularınızı tek panelden yönetin."
      />

      {/* Düzenle / Bitti toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            editMode
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          aria-pressed={editMode}
        >
          {editMode ? (
            <>
              <span aria-hidden="true">✓</span>
              <span>Bitti</span>
            </>
          ) : (
            <>
              <Pencil className="w-3.5 h-3.5" strokeWidth={2.4} />
              <span>Düzenle</span>
            </>
          )}
        </button>
      </div>

      {(quickActionItems.length > 0 || editMode) && (
        <QuickActionsRow
          items={quickActionItems}
          editMode={editMode}
          token={token}
          onHide={hideQuickAction}
          canAdd={editMode && quickActionItems.length < ALL_SITE_QUICK_ACTION_KEYS.length}
          onAddClick={() => setAddModalKind("quick")}
        />
      )}

      {/* KPI grid */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {kpiItems.map((item) => (
            <EditableTile
              key={item.key}
              editMode={editMode}
              onHide={() => hideKpiCard(item.key)}
            >
              <StatCard
                Icon={item.Icon}
                value={kpiDisplay(item)}
                label={item.label}
                href={editMode ? undefined : item.hrefFor(token)}
              />
            </EditableTile>
          ))}
          {editMode && kpiItems.length < ALL_SITE_KPI_CARD_KEYS.length && (
            <AddTilePlaceholder onClick={() => setAddModalKind("kpi")} />
          )}
        </div>
      )}

      {/* Hesap & Ayarlar */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Hesap & ayarlar
        </div>
        <ListCard
          Icon={Building2}
          title="Bina Bilgileri"
          subtitle="Yönettiğiniz bina, daire sayısı, sakin listesi"
          rightLabel="Aç"
          href={q("/tr/site-sakinlerim")}
        />
        <ListCard
          Icon={Sparkles}
          title="Profilim"
          subtitle="Yönetici bilgilerinizi düzenleyin"
          rightLabel="Düzenle"
          href={q("/tr/profil-duzenle")}
        />
      </div>

      {showKvkkModal && (
        <KvkkConsentModal
          tenantKey="siteyonetim"
          onAccepted={onKvkkAccepted}
          onDefer={onKvkkDefer}
        />
      )}

      <ItemAddModal
        open={addModalKind === "quick"}
        title="Hızlı İşlem Ekle"
        items={ALL_SITE_QUICK_ACTION_KEYS.map((k) => {
          const def = SITE_QUICK_ACTIONS[k];
          return { key: k, label: def.label, Icon: def.Icon };
        })}
        selectedKeys={currentQuickActions}
        onToggle={(key) => toggleQuickAction(key as SiteQuickActionKey)}
        onClose={() => setAddModalKind(null)}
      />
      <ItemAddModal
        open={addModalKind === "kpi"}
        title="KPI Kart Ekle"
        items={ALL_SITE_KPI_CARD_KEYS.map((k) => {
          const def = SITE_KPI_CARDS[k];
          return { key: k, label: def.label, Icon: def.Icon };
        })}
        selectedKeys={currentKpiCards}
        onToggle={(key) => toggleKpiCard(key as SiteKpiCardKey)}
        onClose={() => setAddModalKind(null)}
      />
    </div>
  );
}

function EditableTile({
  editMode,
  onHide,
  children,
}: {
  editMode: boolean;
  onHide: () => void;
  children: React.ReactNode;
}) {
  if (!editMode) return <>{children}</>;
  return (
    <div className="relative edit-jiggle">
      {children}
      <button
        type="button"
        onClick={onHide}
        aria-label="Kaldır"
        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-md flex items-center justify-center z-10 ring-2 ring-white dark:ring-slate-900"
      >
        <X className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
    </div>
  );
}

function AddTilePlaceholder({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition aspect-square min-h-[88px]"
      aria-label="Ekle"
    >
      <Plus className="w-6 h-6" strokeWidth={2.2} />
      <span className="text-xs font-medium">Ekle</span>
    </button>
  );
}

interface QuickActionsRowProps {
  items: SiteQuickActionDef[];
  editMode: boolean;
  token: string;
  onHide: (key: SiteQuickActionKey) => void;
  canAdd: boolean;
  onAddClick: () => void;
}

function QuickActionsRow({ items, editMode, token, onHide, canAdd, onAddClick }: QuickActionsRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  const scrollByDelta = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-4">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 px-1">
        Hızlı işlem
      </div>
      <div className="relative">
        {canL && (
          <>
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10" />
            <button
              type="button"
              onClick={() => scrollByDelta(-120)}
              aria-label="Önceki"
              className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
            </button>
          </>
        )}
        <div
          ref={scrollRef}
          onScroll={update}
          className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scroll-smooth"
        >
          {items.map((def) => (
            <div key={def.key} className="flex-shrink-0">
              <EditableTile editMode={editMode} onHide={() => onHide(def.key)}>
                <ActionCircle
                  Icon={def.Icon}
                  label={def.label}
                  href={editMode ? undefined : def.hrefFor(token)}
                />
              </EditableTile>
            </div>
          ))}
          {canAdd && (
            <button
              type="button"
              onClick={onAddClick}
              className="flex flex-col items-center gap-2 min-w-[68px] group"
              aria-label="Ekle"
            >
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition group-active:scale-95">
                <Plus className="w-6 h-6" strokeWidth={2.2} />
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ekle</span>
            </button>
          )}
        </div>
        {canR && (
          <>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10" />
            <button
              type="button"
              onClick={() => scrollByDelta(120)}
              aria-label="Sonraki"
              className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition"
            >
              <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
