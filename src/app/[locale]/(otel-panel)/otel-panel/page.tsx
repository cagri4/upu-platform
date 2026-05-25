"use client";

/**
 * Otel Panelim — banking primitives + in-place edit (emlak/bayi paterni port).
 *
 * Pattern: bayi-panel/page.tsx ile aynı görsel dil + Düzenle/Bitti toggle.
 * Edit mode'da Quick Actions + KPI grid jiggle + ✕ overlay, "+ Ekle"
 * placeholder catalog'da kalan item'lar için.
 *
 * Layout persist: /api/otel-panel/layout (GET/PATCH) →
 * metadata.otel_panel_layout = { quick_actions, kpi_cards }.
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
  Monitor,
  MessageCircle,
} from "lucide-react";
import { usePanelChrome } from "@/components/admin-layout";
import { useIsMobileDevice } from "@/lib/use-is-mobile-device";
import {
  HeroBanner,
  StatCard,
  ActionCircle,
  ListCard,
  InfoChip,
  Skeleton,
  KvkkConsentModal,
} from "@/components/banking";
import { OTEL_QUICK_ACTIONS, type OtelQuickActionDef } from "@/platform/quick-actions/otel-catalog";
import {
  ALL_OTEL_QUICK_ACTION_KEYS,
  DEFAULT_OTEL_QUICK_ACTIONS,
  type OtelQuickActionKey,
} from "@/platform/quick-actions/otel-keys";
import { OTEL_KPI_CARDS } from "@/platform/kpi-cards/otel-catalog";
import {
  ALL_OTEL_KPI_CARD_KEYS,
  DEFAULT_OTEL_KPI_CARDS,
  type OtelKpiCardKey,
} from "@/platform/kpi-cards/otel-keys";
import { ItemAddModal } from "@/components/panel-edit/item-add-modal";

interface KPIs {
  occupancy_pct: number;
  reservations_week: number;
  today_checkin: number;
  today_checkout: number;
  monthly_revenue: number;
  precheckin_pending: number;
}

function formatCurrency(n: number): string {
  if (!n) return "₺0";
  if (n >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₺${Math.round(n / 1_000)}K`;
  return `₺${Math.round(n).toLocaleString("tr-TR")}`;
}

function formatKpiValue(
  value: number | undefined,
  format: "pct" | "currency" | "count" | undefined,
): string {
  if (value === undefined || value === null) return "—";
  if (format === "pct") return `${value}%`;
  if (format === "currency") return formatCurrency(value);
  return value.toLocaleString("tr-TR");
}

export default function OtelPanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";
  const { openQrScanner } = usePanelChrome();
  const isMobileDevice = useIsMobileDevice();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [showKvkkModal, setShowKvkkModal] = useState(false);

  // Layout edit state — null = henüz fetch edilmedi (default'a fallback)
  const [quickActions, setQuickActions] = useState<OtelQuickActionKey[] | null>(null);
  const [kpiCards, setKpiCards] = useState<OtelKpiCardKey[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [addModalKind, setAddModalKind] = useState<"quick" | "kpi" | null>(null);

  // KPI dashboard
  useEffect(() => {
    const qs = token ? `?t=${encodeURIComponent(token)}` : "";
    fetch(`/api/otel-panel/dashboard${qs}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error && d?.kpis) setKpis(d.kpis);
      })
      .catch(() => { /* layout init zaten validate etti */ })
      .finally(() => setKpisLoading(false));
  }, [token]);

  // Layout fetch — single source of truth
  useEffect(() => {
    fetch("/api/otel-panel/layout", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        if (Array.isArray(d?.quick_actions)) setQuickActions(d.quick_actions);
        if (Array.isArray(d?.kpi_cards)) setKpiCards(d.kpi_cards);
      })
      .catch(() => { /* default kalır */ });
  }, []);

  // KVKK consent — needsConsent=true ise modal; "Daha sonra" diyene
  // localStorage flag ile aynı gün tekrar gösterme. 401/403 retry race fix.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let dismissedToday = false;
    try {
      dismissedToday = window.localStorage.getItem("kvkk_modal_dismissed_today") === today;
    } catch { /* private mode / quota */ }
    if (dismissedToday) return;

    let cancelled = false;
    let attempt = 0;
    const tryFetch = async (): Promise<void> => {
      attempt++;
      try {
        const r = await fetch("/api/profile/kvkk-status", { credentials: "same-origin" });
        if (cancelled) return;
        if ((r.status === 401 || r.status === 403) && attempt < 3) {
          setTimeout(() => void tryFetch(), 500 * attempt);
          return;
        }
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled && d?.needsConsent) setShowKvkkModal(true);
      } catch {
        if (!cancelled && attempt < 3) setTimeout(() => void tryFetch(), 500 * attempt);
      }
    };
    void tryFetch();
    return () => {
      cancelled = true;
    };
  }, []);

  function onKvkkAccepted() {
    setShowKvkkModal(false);
    try { window.localStorage.removeItem("kvkk_modal_dismissed_today"); } catch {/* yut */}
  }
  function onKvkkDefer() {
    setShowKvkkModal(false);
    const today = new Date().toISOString().slice(0, 10);
    try { window.localStorage.setItem("kvkk_modal_dismissed_today", today); } catch {/* yut */}
  }

  const currentQuickActions: OtelQuickActionKey[] = quickActions ?? DEFAULT_OTEL_QUICK_ACTIONS;
  const currentKpiCards: OtelKpiCardKey[] = kpiCards ?? DEFAULT_OTEL_KPI_CARDS;

  async function patchPanelLayout(
    updates: { quick_actions?: OtelQuickActionKey[]; kpi_cards?: OtelKpiCardKey[] },
  ) {
    try {
      await fetch("/api/otel-panel/layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(updates),
      });
    } catch {
      /* sessiz — bir sonraki toggle'da retry; UI zaten optimistic */
    }
  }

  function hideQuickAction(key: OtelQuickActionKey) {
    const next = currentQuickActions.filter((k) => k !== key);
    setQuickActions(next);
    void patchPanelLayout({ quick_actions: next });
  }
  function hideKpiCard(key: OtelKpiCardKey) {
    const next = currentKpiCards.filter((k) => k !== key);
    setKpiCards(next);
    void patchPanelLayout({ kpi_cards: next });
  }
  function toggleQuickAction(key: OtelQuickActionKey) {
    const has = currentQuickActions.includes(key);
    const next = has
      ? currentQuickActions.filter((k) => k !== key)
      : [...currentQuickActions, key];
    setQuickActions(next);
    void patchPanelLayout({ quick_actions: next });
  }
  function toggleKpiCard(key: OtelKpiCardKey) {
    const has = currentKpiCards.includes(key);
    const next = has
      ? currentKpiCards.filter((k) => k !== key)
      : [...currentKpiCards, key];
    setKpiCards(next);
    void patchPanelLayout({ kpi_cards: next });
  }

  const quickActionItems: OtelQuickActionDef[] = currentQuickActions
    .map((k) => OTEL_QUICK_ACTIONS[k])
    .filter((x): x is OtelQuickActionDef => !!x);
  const kpiItems = currentKpiCards
    .map((k) => OTEL_KPI_CARDS[k])
    .filter((x): x is (typeof OTEL_KPI_CARDS)[keyof typeof OTEL_KPI_CARDS] => !!x);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero — sabit "Hoş geldiniz" + alt metin (otel ön-büro vurgu). */}
      {kpisLoading ? (
        <Skeleton height="h-32" />
      ) : (
        <HeroBanner
          title="Hoş geldiniz"
          subtitle="Otel ön-büronuzu buradan yönetin. Hızlı işlemler, rezervasyonlar ve doluluk parmaklarınızın ucunda."
          Icon={Sparkles}
        />
      )}

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

      {/* Quick Actions — yatay scroll row */}
      {(quickActionItems.length > 0 || editMode) && (
        <QuickActionsRow
          items={quickActionItems}
          editMode={editMode}
          token={token}
          onHide={hideQuickAction}
          canAdd={editMode && quickActionItems.length < ALL_OTEL_QUICK_ACTION_KEYS.length}
          onAddClick={() => setAddModalKind("quick")}
        />
      )}

      {/* KPI grid — 2 sütun mobile, 3 desktop. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {kpisLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height="h-32" />
            ))
          : kpiItems.map((item) => (
              <EditableTile
                key={item.key}
                editMode={editMode}
                onHide={() => hideKpiCard(item.key)}
              >
                <StatCard
                  Icon={item.Icon}
                  value={formatKpiValue(kpis ? kpis[item.key] : undefined, item.format)}
                  label={item.label}
                  href={editMode ? undefined : item.hrefFor(token)}
                />
              </EditableTile>
            ))}
        {editMode && !kpisLoading && kpiItems.length < ALL_OTEL_KPI_CARD_KEYS.length && (
          <AddTilePlaceholder onClick={() => setAddModalKind("kpi")} />
        )}
      </div>

      {/* Hesap & ayarlar — alttaki düz list */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Hesap & ayarlar
        </div>
        <ListCard
          Icon={OTEL_QUICK_ACTIONS.calisan_davet.Icon}
          title="Çalışan Davet"
          subtitle="Resepsiyon, kat hizmetleri, muhasebe rolleri"
          rightLabel="Davet Et"
          href={OTEL_QUICK_ACTIONS.calisan_davet.hrefFor(token)}
        />
      </div>

      {/* Info chips */}
      <div className="space-y-2">
        <InfoChip
          Icon={MessageCircle}
          text="WhatsApp'tan ayrıntılı komutlar — rezervasyonekle, brifing, yorumlar, gorevata"
          onClick={() => { /* sadece bilgi */ }}
        />
        {isMobileDevice && (
          <InfoChip
            Icon={Monitor}
            text="Bilgisayardan açın — QR ile saniyeler içinde"
            onClick={openQrScanner}
          />
        )}
      </div>

      {/* Item Add modals */}
      <ItemAddModal
        open={addModalKind === "quick"}
        title="Hızlı işlem ekle / kaldır"
        items={ALL_OTEL_QUICK_ACTION_KEYS.map((k) => ({
          key: k,
          label: OTEL_QUICK_ACTIONS[k].label,
          Icon: OTEL_QUICK_ACTIONS[k].Icon,
        }))}
        selectedKeys={currentQuickActions}
        onToggle={(k) => toggleQuickAction(k as OtelQuickActionKey)}
        onClose={() => setAddModalKind(null)}
      />
      <ItemAddModal
        open={addModalKind === "kpi"}
        title="KPI kartı ekle / kaldır"
        items={ALL_OTEL_KPI_CARD_KEYS.map((k) => ({
          key: k,
          label: OTEL_KPI_CARDS[k].label,
          Icon: OTEL_KPI_CARDS[k].Icon,
        }))}
        selectedKeys={currentKpiCards}
        onToggle={(k) => toggleKpiCard(k as OtelKpiCardKey)}
        onClose={() => setAddModalKind(null)}
      />

      {/* KVKK consent modal */}
      {showKvkkModal && (
        <KvkkConsentModal
          onAccepted={onKvkkAccepted}
          onDefer={onKvkkDefer}
          tenantKey="otel"
        />
      )}
    </div>
  );
}

/* ────────────────────────── shared helpers ──────────────────────────── */

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
  items: OtelQuickActionDef[];
  editMode: boolean;
  token: string;
  onHide: (key: OtelQuickActionKey) => void;
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
              className="flex absolute left-0 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
            </button>
          </>
        )}
        <div
          ref={scrollRef}
          onScroll={update}
          className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((a) => (
            <div key={a.key} className={editMode ? "edit-jiggle relative" : "relative"}>
              <ActionCircle
                Icon={a.Icon}
                label={a.label}
                href={editMode ? undefined : a.hrefFor(token)}
              />
              {editMode && (
                <button
                  type="button"
                  onClick={() => onHide(a.key)}
                  aria-label="Kaldır"
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-md flex items-center justify-center z-10 ring-2 ring-white dark:ring-slate-900"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={3} />
                </button>
              )}
            </div>
          ))}
          {canAdd && (
            <button
              type="button"
              onClick={onAddClick}
              aria-label="Ekle"
              className="flex flex-col items-center justify-center flex-shrink-0 w-16 gap-1 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <span className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 flex items-center justify-center transition">
                <Plus className="w-5 h-5" strokeWidth={2.2} />
              </span>
              <span className="text-[11px] font-medium">Ekle</span>
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
              className="flex absolute right-0 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition"
            >
              <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
