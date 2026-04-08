/**
 * Emlak Tenant — Gamification misyon ve görev tanımları
 */
import { getServiceClient } from "@/platform/auth/supabase";

// ── Keşif Misyonları (tek seferlik) ──────────────────────────────────

export const EMLAK_MISSIONS = [
  // Portföy Sorumlusu
  {
    tenant_key: "emlak", role: "admin", category: "portfoy",
    mission_key: "emlak_ilk_mulk", title: "İlk mülkünüzü ekleyin",
    description: "Portföyünüze ilk mülkü ekleyerek başlayın", emoji: "🏠",
    points: 20, sort_order: 1, is_repeatable: false,
    next_mission: "emlak_mulk_bilgi_tamamla",
    notification_template: "🏠 İlk mülkünüz eklendi! Artık portföyünüz aktif. +20 puan",
  },
  {
    tenant_key: "emlak", role: "admin", category: "portfoy",
    mission_key: "emlak_mulk_bilgi_tamamla", title: "Mülk bilgilerini tamamlayın",
    description: "Bir mülkün tüm bilgilerini eksiksiz doldurun", emoji: "📝",
    points: 15, sort_order: 2, is_repeatable: false,
    next_mission: "emlak_mulk_foto",
    notification_template: "📝 Mülk bilgileri tam! Profesyonel bir portföy görünümü kazandınız. +15 puan",
  },
  {
    tenant_key: "emlak", role: "admin", category: "portfoy",
    mission_key: "emlak_mulk_foto", title: "Mülke fotoğraf ekleyin",
    description: "Fotoğraflı mülkler %70 daha çok ilgi görür", emoji: "📸",
    points: 15, sort_order: 3, is_repeatable: false,
    next_mission: "emlak_fiyat_kontrol",
    notification_template: "📸 Fotoğraf eklendi! Mülkünüz artık çok daha çekici. +15 puan",
  },
  {
    tenant_key: "emlak", role: "admin", category: "portfoy",
    mission_key: "emlak_fiyat_kontrol", title: "Piyasa fiyatını kontrol edin",
    description: "Mülkünüzün fiyatını bölge ortalamasıyla karşılaştırın", emoji: "💰",
    points: 10, sort_order: 4, is_repeatable: false,
    next_mission: "emlak_ilk_musteri",
    notification_template: "💰 Fiyat kontrolü yapıldı! Doğru fiyat = hızlı satış. +10 puan",
  },

  // Satış Destek
  {
    tenant_key: "emlak", role: "admin", category: "musteri",
    mission_key: "emlak_ilk_musteri", title: "İlk müşterinizi ekleyin",
    description: "Müşteri havuzunuzu oluşturmaya başlayın", emoji: "👤",
    points: 20, sort_order: 5, is_repeatable: false,
    next_mission: "emlak_ilk_eslestirme",
    notification_template: "👤 İlk müşteriniz eklendi! Artık eşleştirme yapabilirsiniz. +20 puan",
  },
  {
    tenant_key: "emlak", role: "admin", category: "musteri",
    mission_key: "emlak_ilk_eslestirme", title: "İlk eşleştirmeyi yapın",
    description: "Müşterinizi uygun mülklerle eşleştirin", emoji: "🤝",
    points: 20, sort_order: 6, is_repeatable: false,
    next_mission: "emlak_ilk_sunum",
    notification_template: "🤝 Eşleştirme yapıldı! Müşteriniz için uygun mülkler bulundu. +20 puan",
  },
  {
    tenant_key: "emlak", role: "admin", category: "musteri",
    mission_key: "emlak_ilk_sunum", title: "İlk sunumu gönderin",
    description: "Müşterinize profesyonel bir sunum hazırlayıp gönderin", emoji: "🎯",
    points: 25, sort_order: 7, is_repeatable: false,
    next_mission: "emlak_ilk_takip",
    notification_template: "🎯 İlk sunumunuz gönderildi! Müşteriniz mülkleri inceleyecek. +25 puan",
  },
  {
    tenant_key: "emlak", role: "admin", category: "musteri",
    mission_key: "emlak_ilk_takip", title: "İlk müşteri takibini yapın",
    description: "Sunum gönderdikten sonra müşterinizi takip edin", emoji: "📞",
    points: 15, sort_order: 8, is_repeatable: false,
    next_mission: "emlak_ilk_analiz",
    notification_template: "📞 Takip yapıldı! Aktif takip satış şansını %40 artırır. +15 puan",
  },

  // Pazar Analisti
  {
    tenant_key: "emlak", role: "admin", category: "analiz",
    mission_key: "emlak_ilk_analiz", title: "İlk pazar analizini yapın",
    description: "Bölgenizdeki pazar durumunu inceleyin", emoji: "📊",
    points: 15, sort_order: 9, is_repeatable: false,
    next_mission: "emlak_ilk_brifing",
    notification_template: "📊 Pazar analizi yapıldı! Bölgenizi tanıyorsunuz. +15 puan",
  },

  // Medya
  {
    tenant_key: "emlak", role: "admin", category: "medya",
    mission_key: "emlak_ilk_paylas", title: "İlk sosyal medya paylaşımı",
    description: "Mülkünüzü sosyal medyada paylaşın", emoji: "📱",
    points: 10, sort_order: 10, is_repeatable: false,
    next_mission: null,
    notification_template: "📱 Paylaşım yapıldı! Görünürlüğünüz arttı. +10 puan",
  },

  // Sekreter
  {
    tenant_key: "emlak", role: "admin", category: "organizasyon",
    mission_key: "emlak_ilk_brifing", title: "İlk brifinginizi okuyun",
    description: "Günlük brifing ile gününüzü planlayın", emoji: "📋",
    points: 10, sort_order: 11, is_repeatable: false,
    next_mission: "emlak_ilk_paylas",
    notification_template: "📋 Brifing okundu! Organize danışman = başarılı danışman. +10 puan",
  },
];

// ── Görev Kuralları (tekrarlayan, veri bazlı) ────────────────────────

export interface TaskRule {
  task_type: string;
  title: string;
  emoji: string;
  command: string;
  points: number;
  check: (userId: string, tenantId: string) => Promise<Array<{ entityId?: string; description: string }>>;
}

export const EMLAK_TASK_RULES: TaskRule[] = [
  {
    task_type: "mulk_guncelle",
    title: "Mülk güncelle",
    emoji: "🏠",
    command: "mulkyonet",
    points: 5,
    check: async (userId, tenantId) => {
      const supabase = getServiceClient();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("emlak_properties")
        .select("id, title")
        .eq("user_id", userId).eq("tenant_id", tenantId).eq("status", "aktif")
        .lt("updated_at", thirtyDaysAgo).limit(3);
      return (data || []).map(p => ({
        entityId: p.id,
        description: `"${p.title}" 30+ gündür güncellenmedi — fiyat hala güncel mi?`,
      }));
    },
  },
  {
    task_type: "mulk_bilgi_eksik",
    title: "Eksik bilgileri tamamla",
    emoji: "📝",
    command: "mulkyonet",
    points: 10,
    check: async (userId, tenantId) => {
      const supabase = getServiceClient();
      const { data } = await supabase
        .from("emlak_properties")
        .select("id, title, area, rooms, location_district")
        .eq("user_id", userId).eq("tenant_id", tenantId).eq("status", "aktif")
        .or("area.is.null,rooms.is.null,location_district.is.null").limit(3);
      return (data || []).map(p => ({
        entityId: p.id,
        description: `"${p.title}" bilgileri eksik — tamamlayın`,
      }));
    },
  },
  {
    task_type: "musteri_takip",
    title: "Müşteri takip et",
    emoji: "📞",
    command: "takipEt",
    points: 10,
    check: async (userId) => {
      const supabase = getServiceClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("emlak_customers")
        .select("id, name, updated_at")
        .eq("user_id", userId).eq("status", "active")
        .lt("updated_at", sevenDaysAgo).limit(3);
      return (data || []).map(c => ({
        entityId: c.id,
        description: `${c.name} ile 7+ gündür iletişim kurulmadı`,
      }));
    },
  },
  {
    task_type: "sunum_gonder",
    title: "Sunum gönder",
    emoji: "🎯",
    command: "sunum",
    points: 15,
    check: async (userId) => {
      const supabase = getServiceClient();
      // Müşteriler var ama sunum gönderilmemiş
      const { data: customers } = await supabase
        .from("emlak_customers")
        .select("id, name")
        .eq("user_id", userId).eq("status", "active");

      const { data: presentations } = await supabase
        .from("emlak_presentations")
        .select("content")
        .eq("user_id", userId);

      const presentedCustomers = new Set<string>();
      for (const p of presentations || []) {
        const content = p.content as Record<string, unknown>;
        if (content?.customer) presentedCustomers.add((content.customer as Record<string, unknown>).name as string);
      }

      return (customers || [])
        .filter(c => !presentedCustomers.has(c.name))
        .slice(0, 2)
        .map(c => ({
          entityId: c.id,
          description: `${c.name} için henüz sunum hazırlanmadı`,
        }));
    },
  },
];

// ── Seed missions to DB ─────────────────────────────────────────────

export async function seedEmlakMissions(): Promise<number> {
  const supabase = getServiceClient();
  let count = 0;

  for (const m of EMLAK_MISSIONS) {
    const { data: existing } = await supabase
      .from("platform_missions")
      .select("id")
      .eq("mission_key", m.mission_key)
      .maybeSingle();

    if (!existing) {
      await supabase.from("platform_missions").insert(m);
      count++;
    }
  }

  return count;
}
