/**
 * Bayi Tenant — Gamification misyon ve görev tanımları
 *
 * İki kullanıcı tipi: admin (firma sahibi) + dealer (bayi)
 */
import { getServiceClient } from "@/platform/auth/supabase";
import type { TaskRule } from "@/tenants/emlak/gamification";

// ── Firma Sahibi Keşif Misyonları ───────────────────────────────────

export const BAYI_ADMIN_MISSIONS = [
  {
    tenant_key: "bayi", role: "admin", category: "urun",
    mission_key: "bayi_ilk_urun", title: "İlk ürünü ekleyin",
    description: "Kataloğunuza ilk ürünü ekleyerek başlayın", emoji: "📦",
    points: 20, sort_order: 1, is_repeatable: false,
    next_mission: "bayi_5_urun",
    notification_template: "📦 İlk ürün eklendi! Kataloğunuz aktif. +20 puan",
  },
  {
    tenant_key: "bayi", role: "admin", category: "urun",
    mission_key: "bayi_5_urun", title: "5 ürün ekleyin",
    description: "Kataloğunuzu zenginleştirin — daha çok ürün, daha çok sipariş", emoji: "🏷",
    points: 30, sort_order: 2, is_repeatable: false,
    next_mission: "bayi_ilk_davet",
    notification_template: "🏷 5 ürün katalogda! Bayileriniz artık sipariş verebilir. +30 puan",
  },
  {
    tenant_key: "bayi", role: "admin", category: "bayi_agi",
    mission_key: "bayi_ilk_davet", title: "Bayi davet linki oluşturun",
    description: "Bayilerinizi sisteme davet edin", emoji: "🏪",
    points: 20, sort_order: 3, is_repeatable: false,
    next_mission: "bayi_ilk_kampanya",
    notification_template: "🏪 Davet linki hazır! Bayilerinize gönderin. +20 puan",
  },
  {
    tenant_key: "bayi", role: "admin", category: "satis",
    mission_key: "bayi_ilk_kampanya", title: "İlk kampanya oluşturun",
    description: "Bayilerinize özel kampanya hazırlayın", emoji: "🎯",
    points: 25, sort_order: 4, is_repeatable: false,
    next_mission: "bayi_ilk_bildirim",
    notification_template: "🎯 İlk kampanya oluşturuldu! +25 puan",
  },
  {
    tenant_key: "bayi", role: "admin", category: "iletisim",
    mission_key: "bayi_ilk_bildirim", title: "Bayilere bildirim gönderin",
    description: "Kampanyayı veya duyuruyu bayilerinize iletin", emoji: "📢",
    points: 20, sort_order: 5, is_repeatable: false,
    next_mission: "bayi_ilk_calisan",
    notification_template: "📢 Bildirim gönderildi! Bayileriniz bilgilendirildi. +20 puan",
  },
  {
    tenant_key: "bayi", role: "admin", category: "ekip",
    mission_key: "bayi_ilk_calisan", title: "İlk çalışanı ekleyin",
    description: "Ekibinizi sisteme dahil edin", emoji: "👥",
    points: 20, sort_order: 6, is_repeatable: false,
    next_mission: "bayi_ilk_brifing",
    notification_template: "👥 İlk çalışan eklendi! Ekibiniz büyüyor. +20 puan",
  },
  {
    tenant_key: "bayi", role: "admin", category: "organizasyon",
    mission_key: "bayi_ilk_brifing", title: "İlk brifingi okuyun",
    description: "Günlük brifing ile işlerinizi takip edin", emoji: "📋",
    points: 10, sort_order: 7, is_repeatable: false,
    next_mission: null,
    notification_template: "📋 Brifing okundu! Organize yönetici = başarılı iş. +10 puan\n\n🌟 Tüm keşif görevlerini tamamladınız!",
  },
];

// ── Dealer Keşif Misyonları ─────────────────────────────────────────

export const BAYI_DEALER_MISSIONS = [
  {
    tenant_key: "bayi", role: "dealer", category: "katalog",
    mission_key: "dealer_katalog_incele", title: "Kataloğu inceleyin",
    description: "Mevcut ürünleri ve fiyatları görün", emoji: "📦",
    points: 10, sort_order: 1, is_repeatable: false,
    next_mission: "dealer_ilk_siparis",
    notification_template: "📦 Kataloğu incelediniz! Artık sipariş verebilirsiniz. +10 puan",
  },
  {
    tenant_key: "bayi", role: "dealer", category: "siparis",
    mission_key: "dealer_ilk_siparis", title: "İlk siparişinizi verin",
    description: "Katalogdan ürün seçerek ilk siparişinizi oluşturun", emoji: "🛒",
    points: 25, sort_order: 2, is_repeatable: false,
    next_mission: "dealer_bakiye_kontrol",
    notification_template: "🛒 İlk sipariş verildi! Tebrikler! +25 puan",
  },
  {
    tenant_key: "bayi", role: "dealer", category: "finans",
    mission_key: "dealer_bakiye_kontrol", title: "Bakiye durumunu kontrol edin",
    description: "Güncel bakiyenizi ve borç durumunuzu görün", emoji: "💰",
    points: 10, sort_order: 3, is_repeatable: false,
    next_mission: "dealer_fatura_incele",
    notification_template: "💰 Bakiye kontrol edildi! Finansınıza hakimsiniz. +10 puan",
  },
  {
    tenant_key: "bayi", role: "dealer", category: "finans",
    mission_key: "dealer_fatura_incele", title: "Faturalarınızı inceleyin",
    description: "Fatura geçmişinizi görüntüleyin", emoji: "📄",
    points: 10, sort_order: 4, is_repeatable: false,
    next_mission: "dealer_kampanya_incele",
    notification_template: "📄 Faturalar incelendi! +10 puan",
  },
  {
    tenant_key: "bayi", role: "dealer", category: "kampanya",
    mission_key: "dealer_kampanya_incele", title: "Kampanyaları inceleyin",
    description: "Aktif kampanya ve indirimleri görün", emoji: "🎯",
    points: 10, sort_order: 5, is_repeatable: false,
    next_mission: null,
    notification_template: "🎯 Kampanyalar incelendi! +10 puan\n\n🌟 Sistemi tamamen keşfettiniz!",
  },
];

// ── Firma Sahibi Tekrarlayan Görevler ───────────────────────────────

export const BAYI_ADMIN_TASK_RULES: TaskRule[] = [
  {
    task_type: "stok_kontrol",
    title: "Kritik stok kontrol",
    emoji: "⚠️",
    command: "kritikstok",
    points: 10,
    check: async (userId, tenantId) => {
      const supabase = getServiceClient();
      const { data } = await supabase
        .from("bayi_products")
        .select("id, name, stock_quantity")
        .eq("tenant_id", tenantId).eq("user_id", userId)
        .lt("stock_quantity", 10).limit(3);
      return (data || []).map(p => ({
        entityId: p.id,
        description: `${p.name} stokta ${p.stock_quantity} kaldı — tedarik edin`,
      }));
    },
  },
  {
    task_type: "tahsilat_takip",
    title: "Tahsilat takibi",
    emoji: "💳",
    command: "tahsilat",
    points: 10,
    check: async (userId, tenantId) => {
      const supabase = getServiceClient();
      const { data } = await supabase
        .from("bayi_dealers")
        .select("id, name, company_name, balance")
        .eq("tenant_id", tenantId)
        .gt("balance", 0).order("balance", { ascending: false }).limit(3);
      return (data || []).map(d => ({
        entityId: d.id,
        description: `${d.name || d.company_name} — ${new Intl.NumberFormat("tr-TR").format(d.balance)} TL alacak`,
      }));
    },
  },
  {
    task_type: "siparis_bekleyen",
    title: "Bekleyen siparişleri onayla",
    emoji: "📦",
    command: "siparisler",
    points: 10,
    check: async (userId, tenantId) => {
      const supabase = getServiceClient();
      const { data } = await supabase
        .from("bayi_orders")
        .select("id, status, total_amount, created_at")
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "beklemede"]).limit(3);
      return (data || []).map(o => ({
        entityId: o.id,
        description: `Bekleyen sipariş — ${new Intl.NumberFormat("tr-TR").format(o.total_amount || 0)} TL`,
      }));
    },
  },
];

// ── Command → Mission mapping ───────────────────────────────────────

export const BAYI_MISSION_MAP: Record<string, Record<string, string>> = {
  admin: {
    yeniurun: "bayi_ilk_urun",
    urunler: "bayi_5_urun",
    bayidavet: "bayi_ilk_davet",
    kampanyaolustur: "bayi_ilk_kampanya",
    kampanyabildir: "bayi_ilk_bildirim",
    duyuru: "bayi_ilk_bildirim",
    calisanekle: "bayi_ilk_calisan",
    ozet: "bayi_ilk_brifing",
  },
  dealer: {
    urunler: "dealer_katalog_incele",
    fiyatlar: "dealer_katalog_incele",
    siparisver: "dealer_ilk_siparis",
    bakiyem: "dealer_bakiye_kontrol",
    faturalarim: "dealer_fatura_incele",
    aktifkampanyalar: "dealer_kampanya_incele",
  },
};

// ── Seed ─────────────────────────────────────────────────────────────

export async function seedBayiMissions(): Promise<number> {
  const supabase = getServiceClient();
  let count = 0;

  for (const m of [...BAYI_ADMIN_MISSIONS, ...BAYI_DEALER_MISSIONS]) {
    const { data: existing } = await supabase
      .from("platform_missions").select("id").eq("mission_key", m.mission_key).maybeSingle();
    if (!existing) {
      await supabase.from("platform_missions").insert(m);
      count++;
    }
  }

  return count;
}
