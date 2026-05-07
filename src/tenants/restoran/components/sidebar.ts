/**
 * Restoran panel sidebar config — AdminLayout `sidebarItems` prop'una geçirilir.
 *
 * 8 item: Dashboard, Rezervasyonlar, Masalar, Müdavimler, Menü, Kampanyalar,
 * Raporlar, Profil. Kampanyalar + Raporlar V2 placeholder (sayfalar minimum
 * "yakında" mesajı).
 */
import type { SidebarItem } from "@/components/admin-layout";

export const RESTORAN_SIDEBAR: SidebarItem[] = [
  { id: "dashboard",    label: "Dashboard",     icon: "🏠",  href: t => `/tr/restoran-panel?t=${encodeURIComponent(t)}`,         matchPath: "/tr/restoran-panel" },
  { id: "rezervasyon",  label: "Rezervasyonlar", icon: "📅", href: t => `/tr/restoran-rezervasyonlar?t=${encodeURIComponent(t)}`, matchPath: "/tr/restoran-rezervasyonlar" },
  { id: "masalar",      label: "Masalar",       icon: "🍽",  href: t => `/tr/restoran-masalar?t=${encodeURIComponent(t)}`,       matchPath: "/tr/restoran-masalar" },
  { id: "mudavimler",   label: "Müdavimler",    icon: "💝",  href: t => `/tr/restoran-mudavimler?t=${encodeURIComponent(t)}`,    matchPath: "/tr/restoran-mudavimler" },
  { id: "menu",         label: "Menü",          icon: "📋",  href: t => `/tr/restoran-menu?t=${encodeURIComponent(t)}`,          matchPath: "/tr/restoran-menu" },
  { id: "kampanyalar",  label: "Kampanyalar",   icon: "🎯",  href: t => `/tr/restoran-kampanyalar?t=${encodeURIComponent(t)}`,   matchPath: "/tr/restoran-kampanyalar" },
  { id: "raporlar",     label: "Raporlar",      icon: "📊",  href: t => `/tr/restoran-raporlar?t=${encodeURIComponent(t)}`,      matchPath: "/tr/restoran-raporlar" },
  { id: "profil",       label: "Profil",        icon: "⚙️",   href: t => `/tr/restoran-profil?t=${encodeURIComponent(t)}`,        matchPath: "/tr/restoran-profil" },
];

export const RESTORAN_BRAND_TITLE = "🍽 UPU Restoran";
export const RESTORAN_BRAND_ICON = "🍽";
export const RESTORAN_ACCENT = "amber" as const; // restoran turuncu/amber tonu (orange yerine config'te tanımlı amber)
