"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SIDEBAR_ITEMS: Array<{
  id: string;
  label: string;
  icon: string;
  /** Mobil/desktop link. Token zorunluysa burada inject edilir. */
  href: (token: string) => string;
  /** Aktif highlight için path eşleşmesi. */
  matchPath?: string;
}> = [
  { id: "dashboard",  label: "Dashboard",        icon: "🏠", href: t => `/tr/panel?t=${encodeURIComponent(t)}`,             matchPath: "/tr/panel" },
  { id: "mulkler",    label: "Mülkler",          icon: "🏢", href: t => `/tr/mulklerim?t=${encodeURIComponent(t)}`,         matchPath: "/tr/mulklerim" },
  { id: "musteriler", label: "Müşteriler",       icon: "👥", href: t => `/tr/musterilerim?t=${encodeURIComponent(t)}`,      matchPath: "/tr/musterilerim" },
  { id: "sozlesme",   label: "Sözleşmeler",      icon: "📋", href: t => `/api/panel/start?cmd=sozlesme&t=${encodeURIComponent(t)}` },
  { id: "sunumlar",   label: "Sunumlar",         icon: "📊", href: t => `/tr/sunumlarim?t=${encodeURIComponent(t)}`,        matchPath: "/tr/sunumlarim" },
  { id: "takip",      label: "Takip Listeleri",  icon: "🎯", href: t => `/tr/takip?t=${encodeURIComponent(t)}`,             matchPath: "/tr/takip" },
  { id: "ara",        label: "Portföy Tara",     icon: "🔍", href: t => `/tr/ara?t=${encodeURIComponent(t)}`,               matchPath: "/tr/ara" },
  { id: "profil",     label: "Profilim",         icon: "⚙️",  href: t => `/tr/profil-duzenle?t=${encodeURIComponent(t)}`,    matchPath: "/tr/profil-duzenle" },
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
  children: ReactNode;
}

export function AdminLayout({
  token,
  displayName,
  officeName,
  activeItem,
  botPhone = "31644967207",
  children,
}: AdminLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const firstName = (displayName || "").split(/\s+/)[0] || "";
  const pathname = usePathname() || "";

  // Aktif item: explicit prop > pathname match > "dashboard" default
  const autoActive =
    SIDEBAR_ITEMS.find((it) => it.matchPath && (pathname === it.matchPath || pathname.startsWith(it.matchPath + "/")))?.id;
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
    // WA'a dön — WebView aware (history.back / wa.me fallback)
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

  return (
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
        className={`fixed top-0 left-0 h-full w-64 md:w-16 lg:w-64 bg-stone-900 text-white z-40 transform transition-transform md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="p-5 md:p-3 lg:p-5 border-b border-stone-700 md:flex md:items-center md:justify-center lg:block">
          <div className="text-xl font-bold">
            <span className="md:hidden lg:inline">🖥 UPU Emlak</span>
            <span className="hidden md:inline lg:hidden text-2xl" title="UPU Emlak">🖥</span>
          </div>
          {officeName && (
            <div className="text-xs text-stone-400 mt-1 truncate md:hidden lg:block">{officeName}</div>
          )}
        </div>
        <nav className="p-3 md:p-2 lg:p-3 space-y-1" aria-label="Ana menü">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = item.id === activeId;
            const href = token ? item.href(token) : "#";
            return (
              <a
                key={item.id}
                href={href}
                onClick={() => setDrawerOpen(false)}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 md:gap-0 lg:gap-3 px-3 md:px-2 lg:px-3 py-2.5 md:justify-center lg:justify-start rounded-lg text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                  isActive
                    ? "bg-emerald-600 text-white font-semibold lg:border-l-4 lg:border-emerald-300 lg:-ml-1 lg:pl-4"
                    : "text-stone-300 hover:bg-stone-800 hover:text-white"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="md:hidden lg:inline">{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 md:p-2 lg:p-3 border-t border-stone-700">
          <button
            onClick={handleLogout}
            title="WhatsApp'a Dön"
            className="w-full flex items-center gap-3 md:gap-0 lg:gap-3 px-3 md:px-2 lg:px-3 py-2.5 md:justify-center lg:justify-start rounded-lg text-sm text-stone-300 hover:bg-stone-800 transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <span>💬</span>
            <span className="md:hidden lg:inline">WhatsApp&apos;a Dön</span>
          </button>
        </div>
      </aside>

      {/* Main column — tablet pushes 64px, desktop pushes 256px */}
      <div className="md:ml-16 lg:ml-64">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              className="md:hidden p-2 -ml-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded-lg"
              onClick={() => setDrawerOpen(!drawerOpen)}
              aria-label={drawerOpen ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={drawerOpen}
              aria-controls="sidebar-nav"
            >
              ☰
            </button>
            <div className="flex-1 max-w-md hidden sm:block">
              <input
                type="search"
                placeholder="🔍 Genel arama..."
                className="w-full bg-slate-100 text-slate-700 placeholder:text-slate-400 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled
                aria-label="Arama (yakında)"
              />
            </div>
            <div className="flex-1 sm:flex-none" />
            <div className="flex items-center gap-2 text-slate-500">
              <button
                className="p-2 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Bildirimler (yakında)"
                aria-label="Bildirimler"
              >
                🔔
              </button>
              <button
                className="p-2 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="AI yardımcı (yakında)"
                aria-label="AI yardımcı"
              >
                🤖
              </button>
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-semibold">
                  {firstName.charAt(0).toUpperCase() || "?"}
                </div>
                <span className="text-sm text-slate-700">{firstName || "—"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="p-4 sm:p-6 max-w-6xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
