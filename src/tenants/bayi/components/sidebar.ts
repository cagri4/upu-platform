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
  { id: "risk",          label: "Churn Risk",      icon: "⚠️",  href: q("/tr/bayi-risk"),            matchPath: "/tr/bayi-risk",          requiredRoles: SALES },
  { id: "urunlerim",     label: "Ürünlerim",       icon: "📦", href: q("/tr/bayi-urunlerim"),       matchPath: "/tr/bayi-urunlerim",     requiredRoles: WAREHOUSE },
  { id: "stok",          label: "Stok Yönetimi",   icon: "🏷", href: q("/tr/bayi-stok"),            matchPath: "/tr/bayi-stok",          requiredRoles: WAREHOUSE },
  { id: "siparislerim",  label: "Siparişlerim",    icon: "📋", href: q("/tr/bayi-siparislerim"),    matchPath: "/tr/bayi-siparislerim",  requiredRoles: SALES },
  { id: "gelen-siparisler", label: "Gelen Siparişler", icon: "📥", href: q("/tr/bayilik-siparisleri"), matchPath: "/tr/bayilik-siparisleri", requiredRoles: SALES },
  { id: "tahsilatlarim", label: "Tahsilatlarım",   icon: "💰", href: q("/tr/bayi-tahsilatlarim"),   matchPath: "/tr/bayi-tahsilatlarim", requiredRoles: ACCOUNTING },
  { id: "cari",          label: "Cari Ekstre",     icon: "💳", href: q("/tr/bayi-cari"),            matchPath: "/tr/bayi-cari",          requiredRoles: ACCOUNTING },
  { id: "vade",          label: "Vade Takvimi",    icon: "📅", href: q("/tr/bayi-vade"),            matchPath: "/tr/bayi-vade" },
  { id: "vade-hat",      label: "Vade Hatırlatma", icon: "⏰", href: q("/tr/bayi-vade-hatirlatma"), matchPath: "/tr/bayi-vade-hatirlatma", requiredRoles: ACCOUNTING },
  { id: "faturalarim",   label: "Faturalar",       icon: "🧾", href: q("/tr/bayi-faturalarim"),     matchPath: "/tr/bayi-faturalarim" },
  { id: "odeme",         label: "Online Ödeme",    icon: "💳", href: q("/tr/bayi-online-odeme"),    matchPath: "/tr/bayi-online-odeme" },
  { id: "kampanyalarim", label: "Kampanyalarım",   icon: "📣", href: q("/tr/bayi-kampanya"),        matchPath: "/tr/bayi-kampanya",      requiredRoles: SALES },
  { id: "kamp-otomatik", label: "Otomatik Kural",  icon: "⚡", href: q("/tr/bayi-kampanya-otomatik"), matchPath: "/tr/bayi-kampanya-otomatik", requiredRoles: ADMIN_ONLY },
  { id: "marketing",     label: "Drip Marketing",  icon: "📨", href: q("/tr/bayi-marketing"),       matchPath: "/tr/bayi-marketing",     requiredRoles: ADMIN_ONLY },
  { id: "oneriler",      label: "Öneriler",        icon: "💡", href: q("/tr/bayi-oneriler"),         matchPath: "/tr/bayi-oneriler" },
  { id: "vitrinim",      label: "Vitrinim",        icon: "🏪", href: q("/tr/bayi-vitrinim"),         matchPath: "/tr/bayi-vitrinim" },
  { id: "talepler",      label: "Müşteri Talepleri", icon: "📥", href: q("/tr/bayi-musteri-talepleri"), matchPath: "/tr/bayi-musteri-talepleri" },
  { id: "davet-et",      label: "Davet Et",        icon: "🎁", href: q("/tr/bayi-davet-et"),         matchPath: "/tr/bayi-davet-et" },
  { id: "raporlar",      label: "Cirolarım",       icon: "📊", href: q("/tr/bayi-raporlar"),        matchPath: "/tr/bayi-raporlar",      requiredRoles: ["admin", "satis", "muhasebe"] },
  { id: "takvim",        label: "Takvim",          icon: "📅", href: q("/tr/bayi-takvim"),          matchPath: "/tr/bayi-takvim" },
  { id: "profilim",      label: "Profilim",        icon: "👤", href: q("/tr/bayi-profilim"),        matchPath: "/tr/bayi-profilim" },
  { id: "bildirimler",   label: "Bildirimler",     icon: "🔔", href: q("/tr/bayi-bildirimler"),     matchPath: "/tr/bayi-bildirimler", separatorBefore: true },
  { id: "kullanicilar",  label: "Kullanıcılar",    icon: "👥", href: q("/tr/bayi-kullanicilar"),    matchPath: "/tr/bayi-kullanicilar", requiredRoles: ADMIN_ONLY },
  { id: "ayarlar",       label: "Tenant Ayarları", icon: "⚙️",  href: q("/tr/bayi-ayarlar"),         matchPath: "/tr/bayi-ayarlar" },
  { id: "billing",       label: "Faturalama",      icon: "💳", href: q("/tr/bayi-billing"),         matchPath: "/tr/bayi-billing",       requiredRoles: ADMIN_ONLY },
  { id: "gizlilik",      label: "Gizlilik",        icon: "🔒", href: q("/tr/bayi-gizlilik"),        matchPath: "/tr/bayi-gizlilik", separatorBefore: true },
  { id: "sistem-turu",   label: "📘 Sistem Turu",  icon: "📘", href: (t: string) => t ? `/tr/bayi-panel?t=${encodeURIComponent(t)}&onboarding=1` : "/tr/bayi-panel?onboarding=1", matchPath: "/tr/bayi-sistem-turu", separatorBefore: true },
  { id: "sss",           label: "Sık Sorulan Sorular", icon: "❓", href: q("/tr/bayi-sss"),         matchPath: "/tr/bayi-sss" },
  { id: "wa-destek",     label: "WhatsApp Destek", icon: "💬", href: () => "https://wa.me/31644967207", matchPath: "/wa-destek" },
  { id: "hakkinda",      label: "UPUDev Hakkında", icon: "ℹ️",  href: q("/tr/bayi-hakkinda"),        matchPath: "/tr/bayi-hakkinda", separatorBefore: true },
  { id: "oneri",         label: "Öneri / Şikayet", icon: "💬", href: q("/tr/bayi-oneri"),           matchPath: "/tr/bayi-oneri" },
  { id: "destek",        label: "Destek Talebi",   icon: "🛟", href: q("/tr/bayi-destek"),          matchPath: "/tr/bayi-destek" },
];

// Hassas sayfa erişim check'i (sayfa içi guard için export).
export const BAYI_ROLE_REQUIREMENTS: Record<string, readonly string[]> = {
  "/tr/bayiler": SALES,
  "/tr/bayi-risk": SALES,
  "/tr/bayi-urunlerim": WAREHOUSE,
  "/tr/bayi-stok": WAREHOUSE,
  "/tr/bayi-siparislerim": SALES,
  "/tr/bayilik-siparisleri": SALES,
  "/tr/bayi-tahsilatlarim": ACCOUNTING,
  "/tr/bayi-cari": ACCOUNTING,
  "/tr/bayi-vade-hatirlatma": ACCOUNTING,
  "/tr/bayi-kampanya": SALES,
  "/tr/bayi-kampanya-otomatik": ADMIN_ONLY,
  "/tr/bayi-marketing": ADMIN_ONLY,
  "/tr/bayi-raporlar": ["admin", "satis", "muhasebe"] as const,
  "/tr/bayi-davet": ADMIN_ONLY,
  "/tr/kullanici-davet": ADMIN_ONLY,
  "/tr/bayi-kullanicilar": ADMIN_ONLY,
  "/tr/bayi-billing": ADMIN_ONLY,
};

export const BAYI_BRAND_TITLE = "🏢 UPU Bayi";
export const BAYI_BRAND_ICON = "🏢";
export const BAYI_ACCENT = "indigo" as const;
