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
import { isBayiFeatureEnabled } from "@/tenants/bayi/feature-flags";

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
  { id: "panelim",       label: "Panelim",         icon: "🏠", href: q("/tr/bayi-panel"),           matchPath: "/tr/bayi-panel",
    help: {
      title: "Panelim Nedir?",
      paragraph: "Genel bakış sayfası. Bayi sayısı, açık sipariş, tahsilat, vade gibi KPI'lar; sık kullanılan kısayollar ve sistem önerileri burada toplanır. 'Düzenle' ile kartları kişiselleştirebilirsin.",
      firstStep: { label: "Profilini Tamamla →", href: "/tr/bayi-profilim" },
      agentContext: "help:panelim",
    },
  },
  { id: "bayilerim",     label: "Bayilerim",       icon: "🏢", href: q("/tr/bayiler"),              matchPath: "/tr/bayiler",            requiredRoles: SALES,
    help: {
      title: "Bayilerim Nedir?",
      paragraph: "Senin ağındaki tüm bayiler. Skor, vade durumu, son sipariş, kredi limiti tek tablo. Yeni bayi davet etmek için WA üzerinden tek-tık link gönderirsin.",
      firstStep: { label: "+ Bayi Davet Et", href: "/tr/bayi-davet-et" },
      agentContext: "help:bayilerim",
    },
  },
  { id: "risk",          label: "Churn Risk",      icon: "⚠️",  href: q("/tr/bayi-risk"),            matchPath: "/tr/bayi-risk",          requiredRoles: SALES, visible: () => isBayiFeatureEnabled("bayi.risk_score"),
    help: {
      title: "Churn Risk Nedir?",
      paragraph: "Sipariş vermeyi azaltan veya kesen bayileri 3 seviyede sınıflar: 🔴 Risk (60g+ sipariş yok / 30g+ vade), 🟡 Watch (30g/7g/hacim düşüşü), 🟢 Sağlıklı. Her bayi için recovery aksiyonu öneririz.",
      agentContext: "help:churn-risk",
    },
  },
  { id: "urunlerim",     label: "Ürünlerim",       icon: "📦", href: q("/tr/bayi-urunlerim"),       matchPath: "/tr/bayi-urunlerim",     requiredRoles: WAREHOUSE,
    help: {
      title: "Ürünlerim Nedir?",
      paragraph: "Katalog: bayilerin sipariş verebileceği ürünler (kod, fiyat, KDV, kategori, görsel). Tek tek ekleyebilir veya Excel'den toplu import edebilirsin.",
      firstStep: { label: "+ Ürün Ekle", href: "/tr/bayi-urun-ekle" },
      agentContext: "help:urunlerim",
    },
  },
  { id: "stok",          label: "Stok Yönetimi",   icon: "🏷", href: q("/tr/bayi-stok"),            matchPath: "/tr/bayi-stok",          requiredRoles: WAREHOUSE,
    help: {
      title: "Stok Yönetimi Nedir?",
      paragraph: "Anlık stok seviyesi, kritik altı uyarı, manuel giriş/çıkış kaydı, son hareketler timeline'ı. Her ürün için 'kritik eşik' tanımlarsın — altına düştüğünde 🟡 Kritik olarak işaretlenir.",
      firstStep: { label: "Ürünlere Git", href: "/tr/bayi-urunlerim" },
      agentContext: "help:stok",
    },
  },
  { id: "siparislerim",  label: "Siparişlerim",    icon: "📋", href: q("/tr/bayi-siparislerim"),    matchPath: "/tr/bayi-siparislerim",  requiredRoles: SALES,
    help: {
      title: "Siparişlerim Nedir?",
      paragraph: "Kendi adına verdiğin (veya bayi adına geçtiğin) siparişlerin listesi. Durum tab'leri: Bekleyen / Onaylı / Yolda / Teslim. İptal pending iken yapılabilir.",
      firstStep: { label: "+ Yeni Sipariş", href: "/tr/bayi-siparis-ver" },
      agentContext: "help:siparislerim",
    },
  },
  { id: "gelen-siparisler", label: "Gelen Siparişler", icon: "📥", href: q("/tr/bayilik-siparisleri"), matchPath: "/tr/bayilik-siparisleri", requiredRoles: SALES,
    help: {
      title: "Gelen Siparişler Nedir?",
      paragraph: "Bayilerinden gelen sipariş kuyruğu. Onayla / Reddet, sonra durumu Hazırlanıyor → Kargoya Ver → Teslim Edildi diye ilerletirsin. Sevkiyat aşamasında tracking/plaka girip foto kanıt yükleyebilirsin.",
      agentContext: "help:gelen-siparisler",
    },
  },
  { id: "tahsilatlarim", label: "Tahsilatlarım",   icon: "💰", href: q("/tr/bayi-tahsilatlarim"),   matchPath: "/tr/bayi-tahsilatlarim", requiredRoles: ACCOUNTING,
    help: {
      title: "Tahsilatlarım Nedir?",
      paragraph: "Manuel ödeme kayıtları: bayi 'şu fatura için EFT yatırdım' deyince buraya dekont fotoğrafıyla kaydedersin. Admin onayından sonra cari ekstreye işlenir.",
      agentContext: "help:tahsilatlarim",
    },
  },
  { id: "cari",          label: "Cari Ekstre",     icon: "💳", href: q("/tr/bayi-cari"),            matchPath: "/tr/bayi-cari",          requiredRoles: ACCOUNTING,
    help: {
      title: "Cari Ekstre Nedir?",
      paragraph: "Sipariş + fatura + ödeme hareketlerinin borç/alacak/bakiye tablosu. Bayi başına filtreleyip Excel olarak indirebilirsin. Cari = bayi ile aranızdaki hesap.",
      agentContext: "help:cari",
    },
  },
  { id: "vade",          label: "Vade Takvimi",    icon: "📅", href: q("/tr/bayi-vade"),            matchPath: "/tr/bayi-vade",
    help: {
      title: "Vade Takvimi Nedir?",
      paragraph: "Açık faturaların vade tarihine göre liste: 🟢 Güvenli (7g+), 🟡 Yakın (1-7g), 🔴 Gecikmiş. 'Vade Hatırlatma' otomatik cron'u D-3 / D-1 / D-0 günlerinde bayi'ye WA mesajı atar.",
      firstStep: { label: "Faturalara Git", href: "/tr/bayi-faturalarim" },
      agentContext: "help:vade",
    },
  },
  { id: "vade-hat",      label: "Vade Hatırlatma", icon: "⏰", href: q("/tr/bayi-vade-hatirlatma"), matchPath: "/tr/bayi-vade-hatirlatma", requiredRoles: ACCOUNTING },
  { id: "faturalarim",   label: "Faturalar",       icon: "🧾", href: q("/tr/bayi-faturalarim"),     matchPath: "/tr/bayi-faturalarim" },
  { id: "odeme",         label: "Online Ödeme",    icon: "💳", href: q("/tr/bayi-online-odeme"),    matchPath: "/tr/bayi-online-odeme" },
  { id: "kampanyalarim", label: "Kampanyalarım",   icon: "📣", href: q("/tr/bayi-kampanya"),        matchPath: "/tr/bayi-kampanya",      requiredRoles: SALES, visible: () => isBayiFeatureEnabled("bayi.kampanya_eski") },
  { id: "kamp-otomatik", label: "Otomatik Kural",  icon: "⚡", href: q("/tr/bayi-kampanya-otomatik"), matchPath: "/tr/bayi-kampanya-otomatik", requiredRoles: ADMIN_ONLY },
  { id: "marketing",     label: "Drip Marketing",  icon: "📨", href: q("/tr/bayi-marketing"),       matchPath: "/tr/bayi-marketing",     requiredRoles: ADMIN_ONLY, visible: () => isBayiFeatureEnabled("bayi.marketing_auto") },
  { id: "oneriler",      label: "Öneriler",        icon: "💡", href: q("/tr/bayi-oneriler"),         matchPath: "/tr/bayi-oneriler",       visible: () => isBayiFeatureEnabled("bayi.cross_sell") },
  { id: "vitrinim",      label: "Vitrinim",        icon: "🏪", href: q("/tr/bayi-vitrinim"),         matchPath: "/tr/bayi-vitrinim",       visible: () => isBayiFeatureEnabled("bayi.vitrin") },
  { id: "talepler",      label: "Müşteri Talepleri", icon: "📥", href: q("/tr/bayi-musteri-talepleri"), matchPath: "/tr/bayi-musteri-talepleri", visible: () => isBayiFeatureEnabled("bayi.musteri_talepleri") },
  { id: "davet-et",      label: "Davet Et",        icon: "🎁", href: q("/tr/bayi-davet-et"),         matchPath: "/tr/bayi-davet-et" },
  { id: "raporlar",      label: "Cirolarım",       icon: "📊", href: q("/tr/bayi-raporlar"),        matchPath: "/tr/bayi-raporlar",      requiredRoles: ["admin", "satis", "muhasebe"] },
  { id: "takvim",        label: "Takvim",          icon: "📅", href: q("/tr/bayi-takvim"),          matchPath: "/tr/bayi-takvim",        visible: () => isBayiFeatureEnabled("bayi.takvim") },
  { id: "profilim",      label: "Profilim",        icon: "👤", href: q("/tr/bayi-profilim"),        matchPath: "/tr/bayi-profilim" },
  { id: "bildirimler",   label: "Bildirimler",     icon: "🔔", href: q("/tr/bayi-bildirimler"),     matchPath: "/tr/bayi-bildirimler", separatorBefore: true },
  { id: "kullanicilar",  label: "Kullanıcılar",    icon: "👥", href: q("/tr/bayi-kullanicilar"),    matchPath: "/tr/bayi-kullanicilar", requiredRoles: ADMIN_ONLY },
  { id: "ayarlar",       label: "Tenant Ayarları", icon: "⚙️",  href: q("/tr/bayi-ayarlar"),         matchPath: "/tr/bayi-ayarlar" },
  { id: "billing",       label: "Faturalama",      icon: "💳", href: q("/tr/bayi-billing"),         matchPath: "/tr/bayi-billing",       requiredRoles: ADMIN_ONLY },
  { id: "gizlilik",      label: "Gizlilik",        icon: "🔒", href: q("/tr/bayi-gizlilik"),        matchPath: "/tr/bayi-gizlilik", separatorBefore: true, visible: () => isBayiFeatureEnabled("bayi.gizlilik") },
  { id: "sistem-turu",   label: "📘 Sistem Turu",  icon: "📘", href: (t: string) => t ? `/tr/bayi-panel?t=${encodeURIComponent(t)}&onboarding=1` : "/tr/bayi-panel?onboarding=1", matchPath: "/tr/bayi-sistem-turu", separatorBefore: true },
  { id: "tanitim-turu",  label: "🎯 Tanıtım Turu", icon: "🎯", href: (t: string) => t ? `/tr/bayi-panel?t=${encodeURIComponent(t)}&tour=1` : "/tr/bayi-panel?tour=1", matchPath: "/tr/bayi-tanitim-turu" },
  { id: "sss",           label: "Sık Sorulan Sorular", icon: "❓", href: q("/tr/bayi-sss"),         matchPath: "/tr/bayi-sss" },
  { id: "wa-destek",     label: "WhatsApp Destek", icon: "💬", href: () => "https://wa.me/31644967207", matchPath: "/wa-destek" },
  { id: "hakkinda",      label: "UPUDev Hakkında", icon: "ℹ️",  href: q("/tr/bayi-hakkinda"),        matchPath: "/tr/bayi-hakkinda", separatorBefore: true, visible: () => isBayiFeatureEnabled("bayi.hakkinda") },
  { id: "oneri",         label: "Öneri / Şikayet", icon: "💬", href: q("/tr/bayi-oneri"),           matchPath: "/tr/bayi-oneri",         visible: () => isBayiFeatureEnabled("bayi.oneri_feedback") },
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
