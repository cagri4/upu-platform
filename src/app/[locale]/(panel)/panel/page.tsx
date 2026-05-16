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
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePanelChrome } from "@/components/admin-layout";
import { PwaInstallCard } from "@/components/pwa-install-card";
import { useIsMobileDevice } from "@/lib/use-is-mobile-device";
import {
  HeroBanner,
  ActionCircle,
  StatCard,
  ListCard,
  InfoChip,
  Skeleton,
  KvkkConsentModal,
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
  const isMobileDevice = useIsMobileDevice();

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [webSlug, setWebSlug] = useState<string | null>(null);
  // undefined = henüz fetch edilmedi (skeleton), null = fetched ama kayıt yok,
  // obj = aktif/trial. Hero flicker'ı önlemek için bu ayrım gerekli.
  const [subscription, setSubscription] = useState<SubscriptionSummary | null | undefined>(undefined);
  const [quickActions, setQuickActions] = useState<QuickActionKey[] | null>(null);

  // Google bağla onboarding — Faz 6.5
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showLinkBanner, setShowLinkBanner] = useState(false);
  // KVKK consent — Faz 7.0
  const [showKvkkModal, setShowKvkkModal] = useState(false);

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

  // Google bağla durumu — Faz 6.5 modal/banner kararı.
  //   linked → ikisi de gizli
  //   !linked && !welcomeSeen → modal
  //   !linked && welcomeSeen && (bannerDismissedUntil null veya geçmiş) → banner
  //
  // İlk mount'ta cookie session bazen tam settle olmamış olabilir (panel
  // layout init paralel akıyor). 401/403 dönerse 3 kez exponential backoff
  // retry — kullanıcı ilk açılışta modal'ı kaçırmasın.
  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const tryFetch = async (): Promise<void> => {
      attempt++;
      try {
        const r = await fetch("/api/panel/google-link/status", { credentials: "same-origin" });
        if (cancelled) return;
        if ((r.status === 401 || r.status === 403) && attempt < 3) {
          setTimeout(() => void tryFetch(), 500 * attempt);
          return;
        }
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled || !d || d.linked) return;
        if (!d.welcomeSeen) {
          setShowWelcomeModal(true);
          return;
        }
        const until = d.bannerDismissedUntil as string | null;
        if (!until || new Date(until) <= new Date()) {
          setShowLinkBanner(true);
        }
      } catch {
        if (!cancelled && attempt < 3) setTimeout(() => void tryFetch(), 500 * attempt);
      }
    };
    void tryFetch();
    return () => {
      cancelled = true;
    };
  }, []);

  // KVKK consent — Faz 7.0. needsConsent=true ise modal; "Daha sonra"
  // diyene localStorage flag ile aynı gün tekrar gösterme.
  // Race fix: cookie henüz settle olmamışsa 401/403 retry (max 3 attempt).
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

  const googleLinkHref = "/api/auth/google/start?mode=link&next=/tr/panel";

  async function dismissWelcomeModal() {
    setShowWelcomeModal(false);
    // 3 günlük grace — modal'da "atla" diyene hemen banner ile rahatsız etme
    const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await fetch("/api/panel/google-link/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ type: "welcome", banner_dismissed_until: inThreeDays }),
      });
    } catch { /* sessiz */ }
  }

  async function dismissLinkBanner() {
    setShowLinkBanner(false);
    const inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await fetch("/api/panel/google-link/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ type: "banner", banner_dismissed_until: inSevenDays }),
      });
    } catch { /* sessiz */ }
  }

  // Modal açıkken Escape ile kapatma + body scroll lock
  useEffect(() => {
    if (!showWelcomeModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void dismissWelcomeModal();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showWelcomeModal]);

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

  // Hero slider — slide 1 her zaman "Hoş geldiniz". subscription trial/pro
  // ise 2. slide olarak durum kartı eklenir. Üyelik yoksa tek slide → slider
  // mantığı bypass (plain HeroBanner).
  type HeroSlide = {
    title: string;
    subtitle: string;
    ctaLabel?: string;
    ctaHref?: string;
    Icon: LucideIcon;
  };
  const heroSlides: HeroSlide[] = [
    {
      title: "Hoş geldiniz",
      subtitle:
        "Sisteminizi buradan yönetin. Hızlı işlemler ve mülk-müşteri akışı parmaklarınızın ucunda.",
      ctaLabel: "Üyelik Planları",
      ctaHref: q("/tr/uyelik"),
      Icon: Sparkles,
    },
  ];
  if (isTrial && subscription) {
    heroSlides.push({
      title: `${subscription.daysLeft} gün deneme kaldı`,
      subtitle: "Pro'ya yükseltin, tüm özellikler kalıcı olarak açık kalsın.",
      ctaLabel: "Pro'ya Geç",
      ctaHref: q("/tr/uyelik"),
      Icon: Crown,
    });
  } else if (isPro) {
    heroSlides.push({
      title: "Pro üye",
      subtitle: "Tüm panel özellikleri ve AI işlemleri sınırsız kullanımda.",
      Icon: Crown,
    });
  }

  const [heroIdx, setHeroIdx] = useState(0);

  // Slides sayısı azalırsa idx'i clamp et (örn trial → üyelik kaybı gibi
  // pratikte olmayan durumlar için güvenlik)
  useEffect(() => {
    if (heroIdx >= heroSlides.length) setHeroIdx(0);
  }, [heroSlides.length, heroIdx]);

  const heroPrev = () =>
    setHeroIdx((i) => (i - 1 + heroSlides.length) % heroSlides.length);
  const heroNext = () =>
    setHeroIdx((i) => (i + 1) % heroSlides.length);
  const heroGoTo = (i: number) => setHeroIdx(i);

  // Quick action items — kullanıcı tercihi (profiles.metadata.quick_actions)
  // yoksa default 6. Render aşağıda QuickActionsRow component'inde yapılır
  // (state hook'ları için ayrı component lazım).
  const quickActionItems: QuickActionDef[] = (quickActions ?? DEFAULT_QUICK_ACTIONS)
    .map((k) => QUICK_ACTIONS[k])
    .filter((x): x is QuickActionDef => !!x);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Google bağla persistent banner — modal'dan sonra (3 gün grace) veya
          önceki banner dismiss'ten 7 gün sonra çıkar. linked olunca asla. */}
      {showLinkBanner && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500">
          <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" strokeWidth={2.2} />
          <p className="flex-1 text-sm text-emerald-700 dark:text-emerald-300 leading-snug">
            Google hesabını bağlayarak daha hızlı giriş yap.
          </p>
          <a
            href={googleLinkHref}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium active:scale-95 transition flex-shrink-0"
          >
            Bağla
          </a>
          <button
            type="button"
            onClick={() => void dismissLinkBanner()}
            aria-label="Kapat"
            className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded transition flex-shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2.4} />
          </button>
        </div>
      )}

      {/* Hero slider — subscription fetch sürerken Skeleton (flicker fix).
          Tek slide ise plain HeroBanner; ≥2 ise prev/next ok + dot indicator.
          Auto-advance YOK — sadece manuel kullanıcı kontrolü. */}
      {subscription === undefined ? (
        <Skeleton height="h-32" />
      ) : heroSlides.length === 1 ? (
        <HeroBanner {...heroSlides[0]} />
      ) : (
        <div className="relative">
          <HeroBanner {...heroSlides[heroIdx]} />
          <button
            type="button"
            onClick={heroPrev}
            aria-label="Önceki"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/30 rounded-full shadow-md hover:bg-white dark:hover:bg-slate-800 active:scale-95 transition"
          >
            <ChevronLeft className="w-4 h-4 text-slate-700 dark:text-slate-200" strokeWidth={2.4} />
          </button>
          <button
            type="button"
            onClick={heroNext}
            aria-label="Sonraki"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-white/20 dark:border-slate-700/30 rounded-full shadow-md hover:bg-white dark:hover:bg-slate-800 active:scale-95 transition"
          >
            <ChevronRight className="w-4 h-4 text-slate-700 dark:text-slate-200" strokeWidth={2.4} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => heroGoTo(i)}
                aria-label={`Slayt ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === heroIdx ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
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
      <PwaInstallCard brandName="UPU Emlak" />

      {/* Info chips — sade duyurular */}
      <div className="space-y-2">
        <InfoChip
          Icon={Puzzle}
          text="Sahibinden formunu otomatik doldur — Chrome eklentisi"
          href="https://chromewebstore.google.com/detail/bcafoeijofbhelbanpfjhmhiokjnggbe"
        />
        {isMobileDevice && (
          <InfoChip
            Icon={Monitor}
            text="Bilgisayardan açın — QR ile saniyeler içinde"
            onClick={openQrScanner}
          />
        )}
      </div>

      {/* KVKK consent modal — Faz 7.0. needsConsent=true ise gösterilir;
          önceliklidir, açıkken Google Welcome modal'ı saklı. */}
      {showKvkkModal && (
        <KvkkConsentModal onAccepted={onKvkkAccepted} onDefer={onKvkkDefer} />
      )}

      {/* Welcome modal — Faz 6.5. WA ile yeni gelen kullanıcıya Google
          bağlama önerisi. KVKK modal'ı açıkken bekletilir. */}
      {!showKvkkModal && showWelcomeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => void dismissWelcomeModal()}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-google-title"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
              </div>
              <h2 id="welcome-google-title" className="font-semibold text-slate-900 dark:text-white">
                Daha güvenli giriş
              </h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Google hesabını bağlayarak WhatsApp kaybetsen veya cihaz değiştirsen bile hesabına ulaşabilirsin. İstediğin zaman ayarlardan ekleyebilir veya kaldırabilirsin.
            </p>
            <div className="space-y-2">
              <a
                href={googleLinkHref}
                className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 text-slate-900 dark:text-white font-medium shadow-sm active:scale-[0.98] transition"
              >
                <GoogleGlyph className="w-4 h-4" />
                <span>Google ile Bağla</span>
              </a>
              <button
                type="button"
                onClick={() => void dismissWelcomeModal()}
                className="w-full py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                Şimdilik atla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Google G logo (4-renk official) — modal'da kullanılır. */
function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 18 18" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
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
