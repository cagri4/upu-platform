/**
 * Bayi panel sidebar config — AdminLayout `sidebarItems` prop'una geçirilir.
 *
 * 10 ana item — Panelim, Bayilerim, Siparişlerim, Tahsilatlarım, Vade,
 * Kampanyalarım, Cirolarım, Takvim, Profilim, Panel Ayarları (Sprint A) +
 * 3 alt grup (UPUDev Hakkında, Öneri/Şikayet, Destek).
 *
 * KRİTİK: Tüm href'ler GERÇEK panel sayfasına gider — WA komutuna DEĞİL.
 * (Bölüm 11 bug fix kuralı.)
 *
 * URL pattern: tüm bayi panel route'ları `bayi-` prefix ile (market-panel
 * pattern'i). Sidebar etiketi "Panelim" / "Bayilerim" gibi sade kalır;
 * URL `/tr/bayi-panel`, `/tr/bayi-bayilerim` olur. Emlak `(panel)/panel`
 * ile path çakışmasını önlemek için.
 *
 * Token-optional: Cookie session aktifse AdminLayout `token=""` geçer.
 * `q(path)` helper boş token'da `?t=` query suffix EKLEMEZ — alt sayfalar
 * cookie session fallback ile çalışır (boş `?t=` "Geçersiz link" hatası
 * vermesin diye).
 */
import type { SidebarItem } from "@/components/admin-layout";

const q = (path: string) => (t: string) =>
  t ? `${path}?t=${encodeURIComponent(t)}` : path;

/**
 * Rol bazlı erişim (Iter 2 İş #4):
 *   - admin: hepsi
 *   - muhasebe: cari/fatura/tahsilat görür
 *   - depocu: stok (urunler) görür
 *   - satis: bayi liste + sipariş + kampanya + raporlar görür
 *
 * requiredRoles yoksa = herkes (auth'lı user). Hassas işlem sayfaları
 * (tahsilat, vade, fatura) muhasebe + admin'e açık.
 */
const ADMIN_ONLY = ["admin"];
const SALES = ["admin", "satis"];
const ACCOUNTING = ["admin", "muhasebe"];
const WAREHOUSE = ["admin", "depocu"];

export const BAYI_SIDEBAR: SidebarItem[] = [
  { id: "panelim",       label: "Panelim",         icon: "🏠", href: q("/tr/bayi-panel"),           matchPath: "/tr/bayi-panel" },
  { id: "bayilerim",     label: "Bayilerim",       icon: "🏢", href: q("/tr/bayiler"),              matchPath: "/tr/bayiler",            requiredRoles: SALES },
  { id: "urunlerim",     label: "Ürünlerim",       icon: "📦", href: q("/tr/bayi-urunlerim"),       matchPath: "/tr/bayi-urunlerim",     requiredRoles: WAREHOUSE },
  { id: "siparislerim",  label: "Siparişlerim",    icon: "📋", href: q("/tr/bayi-siparislerim"),    matchPath: "/tr/bayi-siparislerim",  requiredRoles: SALES },
  { id: "tahsilatlarim", label: "Tahsilatlarım",   icon: "💰", href: q("/tr/bayi-tahsilatlarim"),   matchPath: "/tr/bayi-tahsilatlarim", requiredRoles: ACCOUNTING },
  { id: "vade",          label: "Vade Hatırlatma", icon: "⏰", href: q("/tr/bayi-vade-hatirlatma"), matchPath: "/tr/bayi-vade-hatirlatma", requiredRoles: ACCOUNTING },
  { id: "kampanyalarim", label: "Kampanyalarım",   icon: "📣", href: q("/tr/bayi-kampanya"),        matchPath: "/tr/bayi-kampanya",      requiredRoles: SALES },
  { id: "raporlar",      label: "Cirolarım",       icon: "📊", href: q("/tr/bayi-raporlar"),        matchPath: "/tr/bayi-raporlar",      requiredRoles: ["admin", "satis", "muhasebe"] },
  { id: "takvim",        label: "Takvim",          icon: "📅", href: q("/tr/bayi-takvim"),          matchPath: "/tr/bayi-takvim" },
  { id: "profilim",      label: "Profilim",        icon: "👤", href: q("/tr/bayi-profilim"),        matchPath: "/tr/bayi-profilim" },
  { id: "gizlilik",      label: "Gizlilik",        icon: "🔒", href: q("/tr/bayi-gizlilik"),        matchPath: "/tr/bayi-gizlilik", separatorBefore: true },
  { id: "hakkinda",      label: "UPUDev Hakkında", icon: "ℹ️",  href: q("/tr/bayi-hakkinda"),        matchPath: "/tr/bayi-hakkinda", separatorBefore: true },
  { id: "oneri",         label: "Öneri / Şikayet", icon: "💬", href: q("/tr/bayi-oneri"),           matchPath: "/tr/bayi-oneri" },
  { id: "destek",        label: "Destek Talebi",   icon: "🛟", href: q("/tr/bayi-destek"),          matchPath: "/tr/bayi-destek" },
];

// Hassas sayfa erişim check'i (sayfa içi guard için export).
export const BAYI_ROLE_REQUIREMENTS: Record<string, readonly string[]> = {
  "/tr/bayiler": SALES,
  "/tr/bayi-urunlerim": WAREHOUSE,
  "/tr/bayi-siparislerim": SALES,
  "/tr/bayi-tahsilatlarim": ACCOUNTING,
  "/tr/bayi-vade-hatirlatma": ACCOUNTING,
  "/tr/bayi-kampanya": SALES,
  "/tr/bayi-raporlar": ["admin", "satis", "muhasebe"] as const,
  "/tr/bayi-davet": ADMIN_ONLY,
  "/tr/kullanici-davet": ADMIN_ONLY,
};

export const BAYI_BRAND_TITLE = "🏢 UPU Bayi";
export const BAYI_BRAND_ICON = "🏢";
export const BAYI_ACCENT = "indigo" as const;
