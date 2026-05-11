"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { NotificationBell } from "@/components/notification-bell";

/**
 * AdminLayout chrome context — sayfalardan QR scanner modalı tetiklemek
 * için. Panelim sayfasındaki "Bilgisayardan Kullan" kartı openQrScanner()
 * çağırarak sidebar'daki butonla aynı modalı açar.
 */
interface PanelChromeContextValue {
  openQrScanner: () => void;
}

const PanelChromeContext = createContext<PanelChromeContextValue | null>(null);

export function usePanelChrome(): PanelChromeContextValue {
  const ctx = useContext(PanelChromeContext);
  if (!ctx) {
    // AdminLayout dışında çağrılırsa no-op döner — app crash etmesin
    return { openQrScanner: () => {} };
  }
  return ctx;
}

export interface SidebarItem {
  id: string;
  label: string;
  /** Emoji fallback — iconSrc yoksa veya yüklenemezse gösterilir. */
  icon: string;
  /** Opsiyonel görsel ikon yolu (örn '/icons/emlak/panelim.png'). Varsa emoji yerine kullanılır. */
  iconSrc?: string;
  /** Mobil/desktop link. Token zorunluysa burada inject edilir. */
  href: (token: string) => string;
  /** Aktif highlight için path eşleşmesi. */
  matchPath?: string;
  /** Bu item'dan ÖNCE bir ayraç çizgi render et (info bölümü ayırıcı). */
  separatorBefore?: boolean;
}

/**
 * Default emlak sidebar — geriye dönük uyumluluk için. AdminLayout
 * `sidebarItems` prop'u geçilirse onu kullanır, geçilmezse bu default.
 * Yeni tenant'lar (otel, bayi vs.) kendi item listesini geçer.
 *
 * KRİTİK: Tüm href'ler GERÇEK panel sayfasına gider. Hiçbir item /api/panel/start
 * veya wa.me'ye 302'lemiyor (eski "Sözleşmeler → wa.me" bug'ı 2026-05-07'de
 * giderildi — Sözleşmelerim placeholder sayfasına yönlendirir).
 */
const DEFAULT_SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "panelim",     label: "Panelim",          icon: "🏠", iconSrc: "/icons/emlak/panelim.png",    href: t => `/tr/panel?t=${encodeURIComponent(t)}`,             matchPath: "/tr/panel" },
  { id: "mulkler",     label: "Mülklerim",        icon: "🏢", iconSrc: "/icons/emlak/mulkler.png",    href: t => `/tr/mulklerim?t=${encodeURIComponent(t)}`,         matchPath: "/tr/mulklerim" },
  { id: "musteriler",  label: "Müşterilerim",     icon: "👥", iconSrc: "/icons/emlak/musteriler.png", href: t => `/tr/musterilerim?t=${encodeURIComponent(t)}`,      matchPath: "/tr/musterilerim" },
  { id: "sozlesme",    label: "Sözleşmelerim",    icon: "📋", iconSrc: "/icons/emlak/sozlesme.png",   href: t => `/tr/sozlesmelerim?t=${encodeURIComponent(t)}`,    matchPath: "/tr/sozlesmelerim" },
  { id: "sunumlar",    label: "Sunumlarım",       icon: "📊", iconSrc: "/icons/emlak/sunumlar.png",   href: t => `/tr/sunumlarim?t=${encodeURIComponent(t)}`,        matchPath: "/tr/sunumlarim" },
  { id: "takip",       label: "Takiplerim",       icon: "🎯", iconSrc: "/icons/emlak/takip.png",      href: t => `/tr/takip?t=${encodeURIComponent(t)}`,             matchPath: "/tr/takip" },
  { id: "ara",         label: "Portföy Tara",     icon: "🔍", iconSrc: "/icons/emlak/ara.png",        href: t => `/tr/ara?t=${encodeURIComponent(t)}`,               matchPath: "/tr/ara" },
  { id: "takvim",      label: "Takvim",           icon: "📅", iconSrc: "/icons/emlak/takvim.png",     href: t => `/tr/takvim?t=${encodeURIComponent(t)}`,            matchPath: "/tr/takvim" },
  { id: "profil",      label: "Profilim",         icon: "👤", iconSrc: "/icons/emlak/profil.png",     href: t => `/tr/profil-duzenle?t=${encodeURIComponent(t)}`,    matchPath: "/tr/profil-duzenle" },
  { id: "websitem",    label: "Web Sitem",        icon: "🌐", iconSrc: "/icons/emlak/websitem.png",   href: t => `/api/panel/web-sitem?t=${encodeURIComponent(t)}` },
  { id: "ayarlar",     label: "Panel Ayarları",   icon: "⚙️",  href: t => `/tr/panel-ayarlari?t=${encodeURIComponent(t)}`,    matchPath: "/tr/panel-ayarlari", separatorBefore: true },
  { id: "hakkinda",    label: "UPUDev Hakkında",  icon: "ℹ️",  href: t => `/tr/hakkinda?t=${encodeURIComponent(t)}`,           matchPath: "/tr/hakkinda" },
  { id: "oneri",       label: "Öneri / Şikayet",  icon: "💬", href: t => `/tr/oneri?t=${encodeURIComponent(t)}`,             matchPath: "/tr/oneri" },
  { id: "destek",      label: "Destek Talebi",    icon: "🛟", href: t => `/tr/destek?t=${encodeURIComponent(t)}`,            matchPath: "/tr/destek" },
];

export interface AdminLayoutProps {
  /** Magic link token — sidebar linklerinde re-kullanılır. */
  token: string | null;
  /** Üst barda gösterilecek kullanıcı adı. */
  displayName?: string | null;
  /** Üst barda gösterilecek ofis bilgisi. */
  officeName?: string | null;
  /**
   * Aktif sidebar item id'si — opsiyonel override. Geçilmezse usePathname
   * ile otomatik tespit edilir (matchPath ile).
   */
  activeItem?: string;
  /** Üst sağdaki çıkış / WhatsApp'a Dön linki. */
  botPhone?: string;
  /**
   * Tenant-specific sidebar items. Geçilmezse emlak default kullanılır.
   * Replikasyon brief'i her tenant için kendi listesini geçirir.
   */
  sidebarItems?: SidebarItem[];
  /** Sidebar üst başlığı — örn "🖥 UPU Emlak", "🏨 UPU Otel". */
  brandTitle?: string;
  /** Sidebar collapsed (tablet) modda gösterilen ikon. */
  brandIconCollapsed?: string;
  /** Aktif item highlight rengi (Tailwind class — örn "emerald-600"). */
  accentColor?: "emerald" | "rose" | "indigo" | "amber" | "violet" | "cyan";
  /**
   * Tenant key (emlak / bayi / market / otel / restoran / siteyonetim).
   * QR claim çağrısında "hangi panelden tarandı" bilgisi olarak gönderilir.
   */
  tenantKey?: "emlak" | "bayi" | "market" | "otel" | "restoran" | "siteyonetim";
  /**
   * Mobile bottom tab bar item'ları. Geçilirse mobile/tablet'te (md altı)
   * altta sabit 4 sektörel sekme + "Daha" görünür. Geçilmezse sadece
   * sidebar drawer (mevcut davranış).
   * En fazla ilk 4 item gösterilir; 5. otomatik "Daha" → drawer açar.
   */
  bottomTabs?: SidebarItem[];
  children: ReactNode;
}

// Tailwind classes need static class names for JIT — accent map.
const ACCENT_CLASSES: Record<NonNullable<AdminLayoutProps["accentColor"]>, {
  active: string;
  border: string;
  focusRing: string;
  avatar: string;
  bottomActive: string;
}> = {
  emerald: { active: "bg-emerald-600", border: "lg:border-emerald-300", focusRing: "focus:ring-emerald-400", avatar: "bg-emerald-100 text-emerald-700", bottomActive: "text-emerald-600" },
  rose:    { active: "bg-rose-600",    border: "lg:border-rose-300",    focusRing: "focus:ring-rose-400",    avatar: "bg-rose-100 text-rose-700",       bottomActive: "text-rose-600" },
  indigo:  { active: "bg-indigo-600",  border: "lg:border-indigo-300",  focusRing: "focus:ring-indigo-400",  avatar: "bg-indigo-100 text-indigo-700",   bottomActive: "text-indigo-600" },
  amber:   { active: "bg-amber-600",   border: "lg:border-amber-300",   focusRing: "focus:ring-amber-400",   avatar: "bg-amber-100 text-amber-700",     bottomActive: "text-amber-600" },
  violet:  { active: "bg-violet-600",  border: "lg:border-violet-300",  focusRing: "focus:ring-violet-400",  avatar: "bg-violet-100 text-violet-700",   bottomActive: "text-violet-600" },
  cyan:    { active: "bg-cyan-600",    border: "lg:border-cyan-300",    focusRing: "focus:ring-cyan-400",    avatar: "bg-cyan-100 text-cyan-700",       bottomActive: "text-cyan-600" },
};

export function AdminLayout({
  token,
  displayName,
  officeName,
  activeItem,
  botPhone = "31644967207",
  sidebarItems,
  brandTitle = "🖥 UPU Emlak",
  brandIconCollapsed = "🖥",
  accentColor = "emerald",
  tenantKey = "emlak",
  bottomTabs,
  children,
}: AdminLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const firstName = (displayName || "").split(/\s+/)[0] || "";
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const searchParamsToken = searchParams?.get("t") || searchParams?.get("token") || "";
  const items = sidebarItems ?? DEFAULT_SIDEBAR_ITEMS;
  const accent = ACCENT_CLASSES[accentColor];

  // Aktif item: explicit prop > pathname match > "dashboard" default
  const autoActive =
    items.find((it) => it.matchPath && (pathname === it.matchPath || pathname.startsWith(it.matchPath + "/")))?.id;
  const activeId = activeItem ?? autoActive ?? "dashboard";

  // ESC kapat + body scroll lock (drawer açıkken)
  useEffect(() => {
    if (!drawerOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  function handleLogout() {
    // WA'a dön — cookie KORUNUR (sonraki "Panele Git" linkinde direkt açılır)
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
        return;
      }
      window.location.href = `https://wa.me/${botPhone}`;
    } catch {
      window.location.href = `https://wa.me/${botPhone}`;
    }
  }

  async function handleSignOut() {
    // Oturum kapat: cookie temizle, sonra WA'ya yönlendir.
    // Cihaz paylaşımı / başka kullanıcıya devretme senaryosu için.
    try {
      await fetch("/api/panel-session/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // network hatasında bile WA'ya yönlendir, kullanıcı sıkışmasın
    }
    window.location.href = `https://wa.me/${botPhone}`;
  }

  const chromeValue: PanelChromeContextValue = { openQrScanner: () => setQrScannerOpen(true) };

  return (
    <PanelChromeContext.Provider value={chromeValue}>
    <div className="min-h-screen bg-slate-50">
      {/* Skip-to-content (klavye nav) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-stone-900 focus:px-3 focus:py-2 focus:rounded focus:shadow"
      >
        İçeriğe atla
      </a>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — mobile=drawer (w-64), tablet=icon-only (w-16), desktop=full (w-64) */}
      <aside
        id="sidebar-nav"
        className={`fixed top-0 left-0 h-full w-64 md:w-16 lg:w-64 bg-stone-900 text-white z-40 transform transition-transform md:translate-x-0 flex flex-col ${
          drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-5 md:p-3 lg:p-5 border-b border-stone-700 md:flex md:items-center md:justify-center lg:block flex-shrink-0">
          <div className="text-xl font-bold">
            <span className="md:hidden lg:inline">{brandTitle}</span>
            <span className="hidden md:inline lg:hidden text-2xl" title={brandTitle}>{brandIconCollapsed}</span>
          </div>
          {officeName && (
            <div className="text-xs text-stone-400 mt-1 truncate md:hidden lg:block">{officeName}</div>
          )}
        </div>
        <nav className="p-3 md:p-2 lg:p-3 space-y-1 flex-1 overflow-y-auto" aria-label="Ana menü">
          {items.map((item) => {
            const isActive = item.id === activeId;
            // Token yoksa cookie session aktif — item.href("") boş query
            // ile absolute path; layout cookie session ile devam eder.
            const href = item.href(token || "");
            return (
              <div key={item.id}>
                {item.separatorBefore && (
                  <hr className="my-2 border-stone-700" aria-hidden="true" />
                )}
                <a
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  title={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 md:gap-0 lg:gap-3 px-3 md:px-2 lg:px-3 py-2.5 md:justify-center lg:justify-start rounded-lg text-sm transition focus:outline-none focus:ring-2 ${accent.focusRing} ${
                    isActive
                      ? `${accent.active} text-white font-semibold lg:border-l-4 ${accent.border} lg:-ml-1 lg:pl-4`
                      : "text-stone-300 hover:bg-stone-800 hover:text-white"
                  }`}
                >
                  {item.iconSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.iconSrc} alt="" className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <span className="text-base">{item.icon}</span>
                  )}
                  <span className="md:hidden lg:inline">{item.label}</span>
                </a>
              </div>
            );
          })}
        </nav>
        <div className="p-3 md:p-2 lg:p-3 border-t border-stone-700 flex-shrink-0 space-y-1">
          <button
            onClick={() => setQrScannerOpen(true)}
            title="Bilgisayardan Aç"
            className={`w-full flex items-center gap-3 md:gap-0 lg:gap-3 px-3 md:px-2 lg:px-3 py-2.5 md:justify-center lg:justify-start rounded-lg text-sm text-stone-300 hover:bg-stone-800 transition focus:outline-none focus:ring-2 ${accent.focusRing}`}
          >
            <span>🖥</span>
            <span className="md:hidden lg:inline">Bilgisayardan Aç</span>
          </button>
          <button
            onClick={handleLogout}
            title="WhatsApp'a Dön"
            className={`w-full flex items-center gap-3 md:gap-0 lg:gap-3 px-3 md:px-2 lg:px-3 py-2.5 md:justify-center lg:justify-start rounded-lg text-sm text-stone-300 hover:bg-stone-800 transition focus:outline-none focus:ring-2 ${accent.focusRing}`}
          >
            <span>💬</span>
            <span className="md:hidden lg:inline">WhatsApp&apos;a Dön</span>
          </button>
          <button
            onClick={handleSignOut}
            title="Oturumu Kapat"
            className={`w-full flex items-center gap-3 md:gap-0 lg:gap-3 px-3 md:px-2 lg:px-3 py-2 md:justify-center lg:justify-start rounded-lg text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition focus:outline-none focus:ring-2 ${accent.focusRing}`}
          >
            <span>🚪</span>
            <span className="md:hidden lg:inline">Oturumu Kapat</span>
          </button>
        </div>
      </aside>

      {/* Main column — tablet pushes 64px, desktop pushes 256px */}
      <div className="md:ml-16 lg:ml-64">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              className={`md:hidden p-2 -ml-2 text-slate-700 focus:outline-none focus:ring-2 ${accent.focusRing} rounded-lg`}
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={drawerOpen}
              aria-controls="sidebar-nav"
            >
              ☰
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-slate-500">
              <NotificationBell token={searchParamsToken} />
              <a
                href={`https://wa.me/${botPhone}`}
                target="_blank" rel="noopener noreferrer"
                className={`p-2 hover:bg-green-50 rounded-lg focus:outline-none focus:ring-2 ${accent.focusRing} min-w-[44px] min-h-[44px] flex items-center justify-center text-[#25D366] transition-transform hover:scale-110`}
                title="WhatsApp'ta bot ile sohbet"
                aria-label="WhatsApp'a Dön"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-6 h-6"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413"/>
                </svg>
              </a>
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className={`w-8 h-8 rounded-full ${accent.avatar} flex items-center justify-center text-sm font-semibold`}>
                  {firstName.charAt(0).toUpperCase() || "?"}
                </div>
                <span className="text-sm text-slate-700">{firstName || "—"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content — bottom tab bar varsa mobile'da alt padding */}
        <main
          id="main-content"
          className={`p-4 sm:p-6 max-w-6xl mx-auto ${bottomTabs ? "pb-24 md:pb-6" : ""}`}
        >
          {children}
        </main>
      </div>

      {bottomTabs && bottomTabs.length > 0 && (
        <BottomTabBar
          tabs={bottomTabs}
          token={token}
          onMore={() => setDrawerOpen(true)}
          accentClass={accent.bottomActive}
        />
      )}

      <QrScannerModal
        open={qrScannerOpen}
        tenantKey={tenantKey}
        onClose={() => setQrScannerOpen(false)}
      />
    </div>
    </PanelChromeContext.Provider>
  );
}
