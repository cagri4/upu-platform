"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Users,
  FileText,
  Target,
  Presentation,
  Calendar,
  UserCog,
  Globe,
  Bell,
  Crown,
  Sparkles,
  Puzzle,
  Monitor,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usePanelChrome } from "@/components/admin-layout";
import { PwaInstallCard } from "@/components/pwa-install-card";
import {
  HeroBanner,
  ActionCircle,
  StatCard,
  ListCard,
  InfoChip,
  Skeleton,
} from "@/components/banking";
import { QUICK_ACTIONS, type QuickActionDef } from "@/platform/quick-actions/catalog";
import {
  DEFAULT_QUICK_ACTIONS,
  type QuickActionKey,
} from "@/platform/quick-actions/keys";

interface KPIs {
  properties: number;
  customers: number;
  contracts: number;
  presentations: number;
  tracking: number;
  calendar: number;
}

interface SubscriptionSummary {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  daysLeft: number | null;
}

export default function PanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token") || "";
  const { openQrScanner } = usePanelChrome();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [webSlug, setWebSlug] = useState<string | null>(null);
  // undefined = henüz fetch edilmedi (skeleton), null = fetched ama kayıt yok,
  // obj = aktif/trial. Hero flicker'ı önlemek için bu ayrım gerekli.
  const [subscription, setSubscription] = useState<SubscriptionSummary | null | undefined>(undefined);
  const [quickActions, setQuickActions] = useState<QuickActionKey[] | null>(null);

  useEffect(() => {
    const url = token
      ? `/api/panel/dashboard?t=${encodeURIComponent(token)}`
      : `/api/panel/dashboard`;
    fetch(url, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) {
          // Fetch tamamlandı ama hata — skeleton'dan çık, default hero göster
          setSubscription(null);
          return;
        }
        if (d?.kpis) setKpis(d.kpis);
        if (d?.webSlug) setWebSlug(d.webSlug);
        // Subscription null da olabilir (üyelik kaydı yok); her durumda set et
        // ki skeleton'dan çıkalım.
        setSubscription((d?.subscription as SubscriptionSummary | null) ?? null);
        // quickActions null = kullanıcı seçmemiş → default'a fallback
        if (Array.isArray(d?.quickActions)) {
          setQuickActions(d.quickActions as QuickActionKey[]);
        }
      })
      .catch(() => {
        setSubscription(null);
      });
  }, [token]);

  const q = (path: string) => (token ? `${path}?t=${encodeURIComponent(token)}` : path);

  const isPro =
    subscription?.plan === "pro_monthly" || subscription?.plan === "pro_yearly";
  const isTrial =
    subscription?.plan === "trial" && (subscription?.daysLeft ?? 0) > 0;

  // KPI değerleri — API'den geliyor
  const kpiValue = (k: keyof KPIs): string | number => (kpis ? kpis[k] ?? 0 : "—");

  // Üyelik kartı için sağ etiket
  const uyelikLabel = (): string => {
    if (!subscription) return "—";
    if (isPro) return subscription.cancel_at_period_end ? "Bitiyor" : "Pro";
    if (isTrial) return `${subscription.daysLeft} gün`;
    return "Yükselt";
  };

  // Hero içeriği — trial / pro / default
  const heroProps = isTrial
    ? {
        title: `${subscription!.daysLeft} gün deneme kaldı`,
        subtitle: "Pro'ya yükseltin, tüm özellikler kalıcı olarak açık kalsın.",
        ctaLabel: "Pro'ya Geç",
        ctaHref: q("/tr/uyelik"),
        Icon: Crown,
      }
    : isPro
      ? {
          title: "Pro üye",
          subtitle: "Tüm panel özellikleri ve AI işlemleri sınırsız kullanımda.",
          Icon: Crown,
        }
      : {
          title: "Hoş geldiniz",
          subtitle: "Sisteminizi buradan yönetin. Pro üyelikle tüm özellikleri açın.",
          ctaLabel: "Üyelik Planları",
          ctaHref: q("/tr/uyelik"),
          Icon: Sparkles,
        };

  // Quick action items — kullanıcı tercihi (profiles.metadata.quick_actions)
  // yoksa default 6. Render aşağıda QuickActionsRow component'inde yapılır
  // (state hook'ları için ayrı component lazım).
  const quickActionItems: QuickActionDef[] = (quickActions ?? DEFAULT_QUICK_ACTIONS)
    .map((k) => QUICK_ACTIONS[k])
    .filter((x): x is QuickActionDef => !!x);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero — subscription fetch tamamlanmadan flicker'ı önlemek için
          skeleton (default "Hoş geldiniz" → trial "X gün kaldı" sıçraması olmaz). */}
      {subscription === undefined ? (
        <Skeleton height="h-32" />
      ) : (
        <HeroBanner {...heroProps} />
      )}

      {/* Quick Actions — yatay scroll row. Cookie fast-path: panel'e ulaşan
          user zaten oturumlu; hrefFor("") ile token propage etmiyoruz. */}
      {quickActionItems.length > 0 && <QuickActionsRow items={quickActionItems} />}

      {/* KPI grid — 2 sütun mobile, 3 desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          Icon={Building2}
          value={kpiValue("properties")}
          label="Mülklerim"
          href={q("/tr/mulklerim")}
        />
        <StatCard
          Icon={Users}
          value={kpiValue("customers")}
          label="Müşterilerim"
          href={q("/tr/musterilerim")}
        />
        <StatCard
          Icon={FileText}
          value={kpiValue("contracts")}
          label="Sözleşmeler"
          href={q("/tr/sozlesmelerim")}
        />
        <StatCard
          Icon={Target}
          value={kpiValue("tracking")}
          label="Takiplerim"
          href={q("/tr/takip")}
        />
        <StatCard
          Icon={Presentation}
          value={kpiValue("presentations")}
          label="Sunumlarım"
          href={q("/tr/sunumlarim")}
        />
        <StatCard
          Icon={Calendar}
          value={kpiValue("calendar")}
          label="Takvim"
          href={q("/tr/takvim")}
        />
      </div>

      {/* Daha az kullanılan kartlar — list */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-1">
          Hesap & ayarlar
        </div>
        <ListCard
          Icon={UserCog}
          title="Profilim"
          subtitle="Kişisel bilgilerinizi düzenleyin"
          rightLabel="Düzenle"
          href={q("/tr/profil-duzenle")}
        />
        <ListCard
          Icon={Globe}
          title="Web Sitem"
          subtitle={webSlug ? `upudev.nl/u/${webSlug}` : "Kişisel sayfanızı kurun"}
          rightLabel={webSlug ? "Aktif" : "Kur"}
          href={webSlug ? `/u/${webSlug}` : q("/api/panel/web-sitem")}
        />
        <ListCard
          Icon={Crown}
          title="Üyelik"
          subtitle={isPro ? "Pro plan aktif" : isTrial ? "Deneme süresi devam ediyor" : "Pro'ya yükselt"}
          rightLabel={uyelikLabel()}
          href={q("/tr/uyelik")}
        />
        <ListCard
          Icon={Bell}
          title="Bildirimler"
          subtitle="WhatsApp uyarı tercihleri"
          rightLabel="Ayarla"
          href={q("/tr/bildirimler")}
        />
      </div>

      {/* PWA Install — mobile only */}
      <PwaInstallCard />

      {/* Info chips — sade duyurular */}
      <div className="space-y-2">
        <InfoChip
          Icon={Puzzle}
          text="Sahibinden formunu otomatik doldur — Chrome eklentisi"
          href="https://chromewebstore.google.com/detail/bcafoeijofbhelbanpfjhmhiokjnggbe"
        />
        <InfoChip
          Icon={Monitor}
          text="Bilgisayardan açın — QR ile saniyeler içinde"
          onClick={openQrScanner}
        />
      </div>
    </div>
  );
}

/**
 * Hızlı İşlem yatay scroll row — sol/sağ fade gradient + (desktop'ta görünür)
 * chevron butonları ile kullanıcıya daha fazla aksiyon olduğunu sezdirir.
 * Mobile'da swipe doğal; gradient ipucu yeter.
 */
function QuickActionsRow({ items }: { items: QuickActionDef[] }) {
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
    // items.length değişirse yeniden ölç (Panel Ayarları'ndan toggle sonrası)
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
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-8 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition"
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
            <ActionCircle key={a.key} Icon={a.Icon} label={a.label} href={a.hrefFor("")} />
          ))}
        </div>
        {canR && (
          <>
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10" />
            <button
              type="button"
              onClick={() => scrollByDelta(120)}
              aria-label="Sonraki"
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-8 h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition"
            >
              <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-300" strokeWidth={2.2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
