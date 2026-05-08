/**
 * Bayi panel sidebar config — AdminLayout `sidebarItems` prop'una geçirilir.
 *
 * 9 ana item — Panelim, Bayilerim, Siparişlerim, Tahsilatlarım, Vade,
 * Kampanyalarım, Cirolarım, Takvim, Profilim. + 3 alt grup (UPUDev Hakkında,
 * Öneri/Şikayet, Destek) — Dalga 2'de eklendi.
 *
 * KRİTİK: Tüm href'ler GERÇEK panel sayfasına gider — WA komutuna DEĞİL.
 * (Bölüm 11 bug fix kuralı.)
 *
 * URL pattern: tüm bayi panel route'ları `bayi-` prefix ile (market-panel
 * pattern'i). Sidebar etiketi "Panelim" / "Bayilerim" gibi sade kalır;
 * URL `/tr/bayi-panel`, `/tr/bayi-bayilerim` olur. Emlak `(panel)/panel`
 * ile path çakışmasını önlemek için.
 */
import type { SidebarItem } from "@/components/admin-layout";

export const BAYI_SIDEBAR: SidebarItem[] = [
  { id: "panelim",       label: "Panelim",         icon: "🏠", href: t => `/tr/bayi-panel?t=${encodeURIComponent(t)}`,           matchPath: "/tr/bayi-panel" },
  { id: "bayilerim",     label: "Bayilerim",       icon: "🏢", href: t => `/tr/bayiler?t=${encodeURIComponent(t)}`,              matchPath: "/tr/bayiler" },
  { id: "siparislerim",  label: "Siparişlerim",    icon: "📋", href: t => `/tr/bayi-siparislerim?t=${encodeURIComponent(t)}`,    matchPath: "/tr/bayi-siparislerim" },
  { id: "tahsilatlarim", label: "Tahsilatlarım",   icon: "💰", href: t => `/tr/bayi-tahsilatlarim?t=${encodeURIComponent(t)}`,   matchPath: "/tr/bayi-tahsilatlarim" },
  { id: "vade",          label: "Vade Hatırlatma", icon: "⏰", href: t => `/tr/bayi-vade-hatirlatma?t=${encodeURIComponent(t)}`, matchPath: "/tr/bayi-vade-hatirlatma" },
  { id: "kampanyalarim", label: "Kampanyalarım",   icon: "📣", href: t => `/tr/bayi-kampanya?t=${encodeURIComponent(t)}`,        matchPath: "/tr/bayi-kampanya" },
  { id: "raporlar",      label: "Cirolarım",       icon: "📊", href: t => `/tr/bayi-raporlar?t=${encodeURIComponent(t)}`,        matchPath: "/tr/bayi-raporlar" },
  { id: "takvim",        label: "Takvim",          icon: "📅", href: t => `/tr/bayi-takvim?t=${encodeURIComponent(t)}`,          matchPath: "/tr/bayi-takvim" },
  { id: "profilim",      label: "Profilim",        icon: "👤", href: t => `/tr/bayi-profilim?t=${encodeURIComponent(t)}`,        matchPath: "/tr/bayi-profilim" },
  { id: "hakkinda",      label: "UPUDev Hakkında", icon: "ℹ️",  href: t => `/tr/bayi-hakkinda?t=${encodeURIComponent(t)}`,         matchPath: "/tr/bayi-hakkinda", separatorBefore: true },
  { id: "oneri",         label: "Öneri / Şikayet", icon: "💬", href: t => `/tr/bayi-oneri?t=${encodeURIComponent(t)}`,           matchPath: "/tr/bayi-oneri" },
  { id: "destek",        label: "Destek Talebi",   icon: "🛟", href: t => `/tr/bayi-destek?t=${encodeURIComponent(t)}`,          matchPath: "/tr/bayi-destek" },
];

export const BAYI_BRAND_TITLE = "🏢 UPU Bayi";
export const BAYI_BRAND_ICON = "🏢";
export const BAYI_ACCENT = "indigo" as const;
