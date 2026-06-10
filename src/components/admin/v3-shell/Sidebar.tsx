"use client";

/**
 * V3 Sidebar — desktop fixed + mobile slide-in drawer.
 *
 * Props:
 * - locale: tr/en/nl prefix for hrefs
 * - tenantName/userName: footer card
 * - mobileOpen / onMobileClose: drawer state, controlled by AppShell
 *
 * Pattern: tüm linkler `/${locale}/dagitici-panel/...` altında. activeMatch
 * basit prefix string'i — pathname startsWith('match') = aktif.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  Receipt,
  BarChart3,
  FolderTree,
  Tag,
  Megaphone,
  Plug,
} from "lucide-react";

export interface SidebarNavItem {
  label: string;
  href: string;
  match: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface SidebarNavSection {
  section: string;
  items: SidebarNavItem[];
}

export interface SidebarProps {
  locale: string;
  tenantName: string;
  userName: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
  /**
   * Opsiyonel nav override. Verilmezse default dağıtıcı nav'ı kullanılır.
   * Buyer (alıcı) için BUYER_SIDEBAR_NAV ile çağrılır.
   */
  navSections?: SidebarNavSection[];
  /** Sidebar header brand title — default "UPU Dağıtıcı". */
  brandTitle?: string;
  /** Brand letter logo (1 char ideal) — default "U". */
  brandLetter?: string;
  /** Aksanlı renk tonu — default emerald (dağıtıcı). Buyer indigo kullanır. */
  accent?: "emerald" | "indigo";
}

export function Sidebar({
  locale,
  tenantName,
  userName,
  mobileOpen,
  onMobileClose,
  navSections,
  brandTitle = "UPU Dağıtıcı",
  brandLetter = "U",
  accent = "emerald",
}: SidebarProps) {
  const pathname = usePathname() || "";

  const base = `/${locale}/dagitici-panel`;
  const defaultNav: SidebarNavSection[] = [
    {
      section: "Genel",
      items: [
        { label: "Dashboard", href: base, match: base, icon: LayoutDashboard },
        {
          label: "Bayiler",
          href: `${base}/bayiler`,
          match: `${base}/bayiler`,
          icon: Users,
        },
        {
          label: "Siparişler",
          href: `${base}/siparisler`,
          match: `${base}/siparisler`,
          icon: ClipboardList,
        },
        {
          label: "Ürünler",
          href: `${base}/urunler`,
          match: `${base}/urunler`,
          icon: Package,
        },
        {
          label: "Kategoriler",
          href: `${base}/kategoriler`,
          match: `${base}/kategoriler`,
          icon: FolderTree,
        },
        {
          label: "Fiyat Listeleri",
          href: `${base}/fiyat-listeleri`,
          match: `${base}/fiyat-listeleri`,
          icon: Tag,
        },
        {
          label: "Kampanyalar",
          href: `${base}/kampanyalar`,
          match: `${base}/kampanyalar`,
          icon: Megaphone,
        },
      ],
    },
    {
      section: "Finans",
      items: [
        {
          label: "Faturalar",
          href: `${base}/faturalar`,
          match: `${base}/faturalar`,
          icon: Receipt,
        },
        {
          label: "Raporlar",
          href: `${base}/raporlar`,
          match: `${base}/raporlar`,
          icon: BarChart3,
        },
      ],
    },
    {
      section: "Ayarlar",
      items: [
        {
          label: "Entegrasyonlar",
          href: `${base}/ayarlar/entegrasyonlar`,
          match: `${base}/ayarlar/entegrasyonlar`,
          icon: Plug,
        },
      ],
    },
  ];

  const nav = navSections ?? defaultNav;

  const accentCls = {
    activeBg: accent === "indigo" ? "bg-indigo-50" : "bg-emerald-50",
    activeText: accent === "indigo" ? "text-indigo-700" : "text-emerald-700",
    brandBg: accent === "indigo" ? "bg-indigo-600" : "bg-emerald-600",
    avatarBg: accent === "indigo" ? "bg-indigo-600" : "bg-emerald-600",
  };

  const isActive = (match: string) =>
    pathname === match || pathname.startsWith(match + "/");

  const userInitials = userName
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  // Sidebar içeriği — desktop + mobile drawer'da paylaşılır
  const content = (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${accentCls.brandBg} text-xs font-bold text-white`}>
          {brandLetter}
        </span>
        <span className="text-sm font-semibold text-slate-900">{brandTitle}</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {nav.map((group) => (
          <div key={group.section} className="mb-3 last:mb-0">
            <p className="px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              {group.section}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? `${accentCls.activeBg} ${accentCls.activeText}`
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-700">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-2.5 rounded-md bg-slate-50 px-2 py-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${accentCls.avatarBg} text-xs font-semibold text-white`}>
            {userInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
            <p className="truncate text-xs text-slate-500">{tenantName}</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar (lg+) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-slate-200 bg-white lg:flex">
        {content}
      </aside>

      {/* Mobile drawer (< lg) */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-slate-900/40"
          onClick={onMobileClose}
        />
        <aside
          className={`relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          role="dialog"
          aria-label="Kenar menü"
        >
          {content}
        </aside>
      </div>
    </>
  );
}
