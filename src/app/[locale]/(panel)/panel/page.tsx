"use client";

import { useEffect, useState } from "react";
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
  Plus,
  UserPlus,
  FilePlus2,
  Sparkles,
  Puzzle,
  Monitor,
} from "lucide-react";
import { usePanelChrome } from "@/components/admin-layout";
import { PwaInstallCard } from "@/components/pwa-install-card";
import {
  HeroBanner,
  ActionCircle,
  StatCard,
  ListCard,
  InfoChip,
} from "@/components/banking";

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
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

  useEffect(() => {
    const url = token
      ? `/api/panel/dashboard?t=${encodeURIComponent(token)}`
      : `/api/panel/dashboard`;
    fetch(url, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error) {
          if (d?.kpis) setKpis(d.kpis);
          if (d?.webSlug) setWebSlug(d.webSlug);
          if (d?.subscription) setSubscription(d.subscription as SubscriptionSummary);
        }
      })
      .catch(() => {
        /* sessizce yut — layout zaten init'i validate etti */
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

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero */}
      <HeroBanner {...heroProps} />

      {/* Quick Actions — yatay scroll row */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-4">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3 px-1">
          Hızlı işlem
        </div>
        <div className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ActionCircle Icon={Plus} label="Mülk Ekle" href={q("/tr/mulkekle-form")} />
          <ActionCircle Icon={UserPlus} label="Müşteri Ekle" href={q("/tr/musteri-ekle-form")} />
          <ActionCircle Icon={FilePlus2} label="Sözleşme Yap" href={q("/tr/sozlesme-yap")} />
          <ActionCircle Icon={Sparkles} label="Sunum Yarat" href={q("/tr/sunumlarim")} />
          <ActionCircle Icon={Target} label="Takip Ekle" href={q("/tr/takip")} />
          <ActionCircle Icon={Calendar} label="Hatırlatma" href={q("/tr/takvim")} />
        </div>
      </div>

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
