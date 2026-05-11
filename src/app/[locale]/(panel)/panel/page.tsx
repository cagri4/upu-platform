"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePanelChrome } from "@/components/admin-layout";
import { ViewDensityToggle, useViewDensity } from "@/components/view-density-toggle";
import { PwaInstallCard } from "@/components/pwa-install-card";

interface KPIs {
  properties: number;
  customers: number;
  contracts: number;
  presentations: number;
  tracking: number;
  calendar: number;
}

type CardKey = keyof KPIs | "profil" | "websitem" | "bildirimler" | "uyelik";

interface SubscriptionSummary {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  daysLeft: number | null;
}

interface CardDef {
  key: CardKey;
  label: string;
  icon: string;
  iconSrc?: string;
  color: string;
  /** Token + opsiyonel webSlug ile href üretir. */
  href: (t: string, slug: string | null) => string;
  /** "Yakında" badge — placeholder kart. */
  comingSoon?: boolean;
  /** KPI sayı yerine "Aktif" / "—" gibi sabit metin. */
  staticValue?: (slug: string | null) => string | number;
}

// App-icon stilinde pastel arka plan tonları (her kategoriye özel renk)
const CARD_DEFS: Array<CardDef & { bg: string; valueColor: string; labelColor: string }> = [
  { key: "properties",   label: "Mülklerim",   icon: "🏢", iconSrc: "/icons/emlak/mulkler.png",    color: "from-indigo-500 to-blue-600",
    bg: "bg-gradient-to-br from-indigo-100 to-blue-200",      valueColor: "text-indigo-900",  labelColor: "text-indigo-800",
    href: t => `/tr/mulklerim?t=${encodeURIComponent(t)}` },
  { key: "customers",    label: "Müşterilerim", icon: "👥", iconSrc: "/icons/emlak/musteriler.png", color: "from-emerald-500 to-teal-600",
    bg: "bg-gradient-to-br from-emerald-100 to-teal-200",     valueColor: "text-emerald-900", labelColor: "text-emerald-800",
    href: t => `/tr/musterilerim?t=${encodeURIComponent(t)}` },
  { key: "contracts",    label: "Sözleşmeler", icon: "📋", iconSrc: "/icons/emlak/sozlesme.png",   color: "from-amber-500 to-orange-600",
    bg: "bg-gradient-to-br from-amber-100 to-orange-200",     valueColor: "text-amber-900",   labelColor: "text-amber-800",
    href: t => `/tr/sozlesmelerim?t=${encodeURIComponent(t)}` },
  { key: "tracking",     label: "Takiplerim",  icon: "🎯", iconSrc: "/icons/emlak/takip.png",      color: "from-rose-500 to-pink-600",
    bg: "bg-gradient-to-br from-rose-100 to-pink-200",        valueColor: "text-rose-900",    labelColor: "text-rose-800",
    href: t => `/tr/takip?t=${encodeURIComponent(t)}` },
  { key: "presentations", label: "Sunumlarım", icon: "📊", iconSrc: "/icons/emlak/sunumlar.png",   color: "from-violet-500 to-fuchsia-600",
    bg: "bg-gradient-to-br from-violet-100 to-fuchsia-200",   valueColor: "text-violet-900",  labelColor: "text-violet-800",
    href: t => `/tr/sunumlarim?t=${encodeURIComponent(t)}` },
  { key: "calendar",     label: "Takvim",      icon: "📅", iconSrc: "/icons/emlak/takvim.png",     color: "from-sky-500 to-cyan-600",
    bg: "bg-gradient-to-br from-sky-100 to-cyan-200",         valueColor: "text-sky-900",     labelColor: "text-sky-800",
    href: t => `/tr/takvim?t=${encodeURIComponent(t)}` },
  { key: "profil",       label: "Profilim",    icon: "👤", iconSrc: "/icons/emlak/profil.png",     color: "from-stone-600 to-stone-800",
    bg: "bg-gradient-to-br from-stone-100 to-stone-300",      valueColor: "text-stone-900",   labelColor: "text-stone-800",
    href: t => `/tr/profil-duzenle?t=${encodeURIComponent(t)}`, staticValue: () => "Düzenle" },
  { key: "websitem",     label: "Web Sitem",   icon: "🌐", iconSrc: "/icons/emlak/websitem.png",   color: "from-teal-500 to-emerald-700",
    bg: "bg-gradient-to-br from-teal-100 to-emerald-200",     valueColor: "text-teal-900",    labelColor: "text-teal-800",
    href: (t, slug) => slug ? `/u/${slug}` : `/api/panel/web-sitem?t=${encodeURIComponent(t)}`, staticValue: (slug) => slug ? "Aktif" : "Kur" },
  { key: "bildirimler",  label: "Bildirimler", icon: "🔔",                                       color: "from-yellow-500 to-amber-600",
    bg: "bg-gradient-to-br from-yellow-100 to-amber-200",     valueColor: "text-amber-900",   labelColor: "text-amber-800",
    href: t => t ? `/tr/bildirimler?t=${encodeURIComponent(t)}` : `/tr/bildirimler`, staticValue: () => "Ayarla" },
  { key: "uyelik",       label: "Üyelik",      icon: "💎",                                       color: "from-violet-500 to-fuchsia-700",
    bg: "bg-gradient-to-br from-violet-100 to-fuchsia-200",   valueColor: "text-violet-900",  labelColor: "text-violet-800",
    href: t => t ? `/tr/uyelik?t=${encodeURIComponent(t)}` : `/tr/uyelik` },
];

export default function PanelimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || searchParams.get("token");
  const { openQrScanner } = usePanelChrome();
  const { view, columns, setView, setColumns, gridClasses } = useViewDensity("emlak-panelim");

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [webSlug, setWebSlug] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);

  useEffect(() => {
    // Token yoksa cookie session ile dene (cookie-aware dashboard endpoint)
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
      .catch(() => { /* sessizce yut — layout zaten init'i validate etti */ });
  }, [token]);

  function uyelikValue(): string {
    if (!subscription) return "—";
    if (subscription.plan === "pro_monthly" || subscription.plan === "pro_yearly") {
      return subscription.cancel_at_period_end ? "Bitiyor" : "Pro";
    }
    if (subscription.plan === "trial" && (subscription.daysLeft ?? 0) > 0) {
      return `${subscription.daysLeft} gün`;
    }
    return "Yükselt";
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-stone-900 text-white rounded-2xl p-6 shadow-lg">
        <h1 className="text-2xl font-bold">Panelim</h1>
        <p className="text-emerald-100 text-sm mt-2 leading-relaxed">
          Sisteminizi buradan yönetin.
        </p>
        <p className="text-emerald-200/80 text-xs mt-3 italic">
          Paneldeki kartlara sol menüden de ulaşabilirsiniz.
        </p>
      </div>

      {/* View density toggle */}
      <div className="flex justify-end">
        <ViewDensityToggle
          view={view}
          columns={columns}
          onViewChange={setView}
          onColumnsChange={setColumns}
        />
      </div>

      {/* KPI / quick-link grid — yoğunluğa göre adapte */}
      <div className={gridClasses}>
        {CARD_DEFS.map((card) => {
          let value: string | number;
          if (card.key === "uyelik") {
            value = uyelikValue();
          } else if (card.staticValue) {
            value = card.staticValue(webSlug);
          } else {
            value = kpis ? (kpis[card.key as keyof KPIs] ?? 0) : "—";
          }
          // Token yoksa cookie session aktif — boş string ile absolute path
          // üretilir; (panel) layout cookie auth ile devam eder.
          const href = card.href(token || "", webSlug);
          const compact = columns >= 3;
          const mini = columns === 4;
          return (
            <a
              key={card.key}
              href={href}
              className={`block ${card.bg} aspect-square rounded-3xl shadow-sm hover:shadow-md active:scale-95 transition relative flex flex-col items-center justify-center gap-1 text-center ${
                mini ? "p-2" : compact ? "p-3" : "p-4"
              }`}
            >
              {card.comingSoon && (
                <span className={`absolute right-1.5 ${mini ? "top-1 text-[9px] px-1" : "top-2 text-[10px] px-1.5 py-0.5"} bg-white/70 text-slate-700 rounded-full uppercase tracking-wide font-medium`}>
                  Yakında
                </span>
              )}
              {card.iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.iconSrc}
                  alt=""
                  className={`${mini ? "w-10 h-10" : compact ? "w-12 h-12" : "w-16 h-16"} drop-shadow-sm`}
                />
              ) : (
                <div className={mini ? "text-3xl" : compact ? "text-4xl" : "text-5xl"}>{card.icon}</div>
              )}
              <div className={`font-bold leading-none ${card.valueColor} ${
                mini ? "text-base" : compact ? "text-xl" : "text-2xl sm:text-3xl"
              }`}>{value}</div>
              <div className={`font-medium ${card.labelColor} ${mini ? "text-[10px]" : compact ? "text-xs" : "text-sm"}`}>{card.label}</div>
            </a>
          );
        })}
      </div>

      {/* PWA Install — mobile only, standalone'da gizlenir */}
      <PwaInstallCard />

      {/* Sahibinden Otomatik Form — Chrome eklentisi tutorial */}
      <SahibindenTutorialCard />

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

      {/* İpucu — killer özellikler kısa anlatım */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="text-lg">💡</span> İpucu
        </p>
        <ul className="space-y-3 text-sm">
          <li>
            <p className="font-semibold text-slate-900">🎯 Takiplerim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Kart ekle, her sabah Bodrum&apos;daki yeni sahibi ilanları WhatsApp&apos;ınıza gelir.
            </p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">🤖 Mülklerim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Mülk ekledikçe AI saniyelerde profesyonel sunum hazırlar.
            </p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">📋 Sözleşmelerim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Mülk + müşteri seç, AI hukuki taslak metni üretir, paylaşılabilir link ile imzalanır.
            </p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">🌐 Profilim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Bilgileriniz kişisel web sayfanıza otomatik yansır, müşterilere paylaşın.
            </p>
          </li>
          <li>
            <p className="font-semibold text-slate-900">📅 Takvim</p>
            <p className="text-slate-600 leading-snug mt-0.5">
              Tarih ve saat girerek hatırlatıcı kurun, WhatsApp&apos;ınıza zamanı geldiğinde gönderirim.
            </p>
          </li>
        </ul>
      </div>
    </div>
  );
}

function SahibindenTutorialCard() {
  const [open, setOpen] = useState(false);
  const STEPS = [
    { n: "1️⃣", title: "PC'de Chrome açın", desc: "Masaüstünden Chrome tarayıcısını başlatın." },
    { n: "2️⃣", title: "Eklentiyi indirin", desc: "Chrome Web Store'dan ‘UPU Sahibinden Form Doldurucu' eklentisini açın.", link: { url: "https://chromewebstore.google.com/detail/bcafoeijofbhelbanpfjhmhiokjnggbe", label: "🧩 Chrome Web Store →" } },
    { n: "3️⃣", title: "‘Chrome'a Ekle' butonuna tıklayın", desc: "Açılan onay penceresinde ‘Eklenti Ekle' deyin." },
    { n: "4️⃣", title: "sahibinden.com'da ilan ver sayfasına gidin", desc: "Yeni sekmede ilan ver sayfasını açın.", link: { url: "https://banaozel.sahibinden.com/ilan-ver/adim-1/?state=new", label: "🌐 Yeni sekme →" } },
    { n: "5️⃣", title: "Eklenti üst köşede görünecek", desc: "Mülk seçin, tek tıkla form otomatik dolar." },
  ];
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0">📋</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 mb-1">Sahibinden Otomatik Form</h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            Mülk bilgilerinizi <span className="font-semibold text-slate-900">sahibinden.com</span> ilan formuna otomatik doldurur. Chrome eklentimizi yükleyin — 30 dakikalık ilan girişi 3 dakikaya iner.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://chromewebstore.google.com/detail/bcafoeijofbhelbanpfjhmhiokjnggbe"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              🧩 Chrome Eklentisini Kur
            </a>
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="inline-flex items-center gap-1 text-xs text-amber-800 underline hover:text-amber-900"
              aria-expanded={open}
            >
              {open ? "Daha az göster ▴" : "Nasıl çalışır? ▾"}
            </button>
          </div>
          {open && (
            <ol className="mt-4 space-y-3 text-sm border-t border-amber-200 pt-3">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="flex-shrink-0 text-base">{s.n}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 leading-tight">{s.title}</p>
                    <p className="text-slate-600 text-xs mt-0.5">{s.desc}</p>
                    {s.link && (
                      <a
                        href={s.link.url}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-block mt-1 text-xs text-amber-800 underline hover:text-amber-900 break-all"
                      >
                        {s.link.label}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
