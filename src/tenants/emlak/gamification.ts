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
    notification_template: "🏠 İlk mülkünüz eklendi! Artık portföyünüz aktif.",
  },
  {
    tenant_key: "emlak", role: "admin", category: "portfoy",
    mission_key: "emlak_mulk_bilgi_tamamla", title: "Mülk bilgilerini tamamlayın",
    description: "Bir mülkün tüm bilgilerini eksiksiz doldurun", emoji: "📝",
    points: 15, sort_order: 2, is_repeatable: false,
    next_mission: "emlak_mulk_foto",
    notification_template: "📝 Mülk bilgileri tam! Profesyonel bir portföy görünümü kazandınız.",
  },
  {
    tenant_key: "emlak", role: "admin", category: "portfoy",
    mission_key: "emlak_mulk_foto", title: "Mülke fotoğraf ekleyin",
    description: "Fotoğraflı mülkler %70 daha çok ilgi görür", emoji: "📸",
    points: 15, sort_order: 3, is_repeatable: false,
    next_mission: "emlak_fiyat_kontrol",
    notification_template: "📸 Fotoğraf eklendi! Mülkünüz artık çok daha çekici.",
  },
  {
    tenant_key: "emlak", role: "admin", category: "portfoy",
    mission_key: "emlak_fiyat_kontrol", title: "Piyasa fiyatını kontrol edin",
    description: "Mülkünüzün fiyatını bölge ortalamasıyla karşılaştırın", emoji: "💰",
    points: 10, sort_order: 4, is_repeatable: false,
    next_mission: "emlak_ilk_musteri",
    notification_template: "💰 Fiyat kontrolü yapıldı! Doğru fiyat = hızlı satış.",
  },

  // Satış Destek
  {
    tenant_key: "emlak", role: "admin", category: "musteri",
    mission_key: "emlak_ilk_musteri", title: "İlk müşterinizi ekleyin",
    description: "Müşteri havuzunuzu oluşturmaya başlayın", emoji: "👤",
    points: 20, sort_order: 5, is_repeatable: false,
    next_mission: "emlak_ilk_eslestirme",
    notification_template: "👤 İlk müşteriniz eklendi! Artık eşleştirme yapabilirsiniz.",
  },
  {
    tenant_key: "emlak", role: "admin", category: "musteri",
    mission_key: "emlak_ilk_eslestirme", title: "İlk eşleştirmeyi yapın",
    description: "Müşterinizi uygun mülklerle eşleştirin", emoji: "🤝",
    points: 20, sort_order: 6, is_repeatable: false,
    next_mission: "emlak_ilk_sunum",
    notification_template: "🤝 Eşleştirme yapıldı! Müşteriniz için uygun mülkler bulundu.",
  },
  {
    tenant_key: "emlak", role: "admin", category: "musteri",
    mission_key: "emlak_ilk_sunum", title: "İlk sunumu gönderin",
    description: "Müşterinize profesyonel bir sunum hazırlayıp gönderin", emoji: "🎯",
    points: 25, sort_order: 7, is_repeatable: false,
    next_mission: "emlak_ilk_takip",
    notification_template: "🎯 İlk sunumunuz gönderildi! Müşteriniz mülkleri inceleyecek.",
  },
  {
    tenant_key: "emlak", role: "admin", category: "musteri",
    mission_key: "emlak_ilk_takip", title: "İlk müşteri takibini yapın",
    description: "Sunum gönderdikten sonra müşterinizi takip edin", emoji: "📞",
    points: 15, sort_order: 8, is_repeatable: false,
    next_mission: "emlak_ilk_analiz",
    notification_template: "📞 Takip yapıldı! Aktif takip satış şansını %40 artırır.",
  },

  // Pazar Analisti
  {
    tenant_key: "emlak", role: "admin", category: "analiz",
    mission_key: "emlak_ilk_analiz", title: "İlk pazar analizini yapın",
    description: "Bölgenizdeki pazar durumunu inceleyin", emoji: "📊",
    points: 15, sort_order: 9, is_repeatable: false,
    next_mission: "emlak_ilk_brifing",
    notification_template: "📊 Pazar analizi yapıldı! Bölgenizi tanıyorsunuz.",
  },

  // Medya
  {
    tenant_key: "emlak", role: "admin", category: "medya",
    mission_key: "emlak_ilk_paylas", title: "İlk sosyal medya paylaşımı",
    description: "Mülkünüzü sosyal medyada paylaşın", emoji: "📱",
    points: 10, sort_order: 10, is_repeatable: false,
    next_mission: null,
    notification_template: "📱 Paylaşım yapıldı! Görünürlüğünüz arttı.",
  },

  // Sekreter
  {
    tenant_key: "emlak", role: "admin", category: "organizasyon",
    mission_key: "emlak_ilk_brifing", title: "İlk brifinginizi okuyun",
    description: "Günlük brifing ile gününüzü planlayın", emoji: "📋",
    points: 10, sort_order: 11, is_repeatable: false,
    next_mission: "emlak_ilk_paylas",
    notification_template: "📋 Brifing okundu! Organize danışman = başarılı danışman.",
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

  // ── Kullanım bazlı görevler ─────────────────────────────

  {
    task_type: "mulk_ekle_gunluk",
    title: "Yeni mülk ekle",
    emoji: "➕",
    command: "mulkekle",
    points: 10,
    check: async (userId, tenantId) => {
      const supabase = getServiceClient();
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      // Check if user added any property today
      const { data } = await supabase
        .from("emlak_properties")
        .select("id")
        .eq("user_id", userId).eq("tenant_id", tenantId)
        .gte("created_at", todayStart.toISOString())
        .limit(1);
      if (data?.length) return []; // Already added today
      // Check if user has any properties at all
      const { count } = await supabase
        .from("emlak_properties")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId).eq("status", "aktif");
      if ((count || 0) < 3) {
        return [{ description: "Portföyünüzü güçlendirin — yeni mülk ekleyin (+10 puan)" }];
      }
      return [{ description: "Bugün henüz mülk eklemediniz. Portföyünüzü genişletin (+10 puan)" }];
    },
  },
  {
    task_type: "komut_kesif",
    title: "Yeni özellik keşfet",
    emoji: "🔍",
    command: "",
    points: 10,
    check: async (userId, tenantId) => {
      const supabase = getServiceClient();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get commands used in last 7 days
      const { data: recentActivity } = await supabase
        .from("bot_activity")
        .select("action")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo);

      const usedCommands = new Set((recentActivity || []).map(a => a.action));

      // Commands that should be used but weren't
      const importantCommands: Array<{ cmd: string; label: string; why: string }> = [
        { cmd: "fiyatsor", label: "Fiyat sorgusu", why: "Doğru fiyat = hızlı satış" },
        { cmd: "eslestir", label: "Müşteri eşleştir", why: "Eşleşme = satış fırsatı" },
        { cmd: "sunum", label: "Sunum gönder", why: "Sunum = profesyonel izlenim" },
        { cmd: "analiz", label: "Pazar analizi", why: "Piyasayı bilin, doğru fiyatlayın" },
        { cmd: "trend", label: "Pazar trendi", why: "Trendi takip edin, önde olun" },
        { cmd: "paylas", label: "Sosyal medya paylaş", why: "Paylaşım = görünürlük" },
        { cmd: "degerle", label: "Mülk değerleme", why: "Mülkünüzün gerçek değerini bilin" },
      ];

      const unused = importantCommands.filter(c => !usedCommands.has(c.cmd));
      if (unused.length === 0) return [];

      // Pick one random unused command
      const pick = unused[Math.floor(Math.random() * unused.length)];
      return [{
        description: `Bu hafta "${pick.label}" kullanmadınız. ${pick.why} (+10 puan)`,
      }];
    },
  },
  {
    task_type: "brifing_oku",
    title: "Brifing oku",
    emoji: "📋",
    command: "brifing",
    points: 5,
    check: async (userId) => {
      const supabase = getServiceClient();
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("bot_activity")
        .select("id")
        .eq("user_id", userId)
        .eq("action", "brifing")
        .gte("created_at", todayStart.toISOString())
        .limit(1);
      if (data?.length) return []; // Already read today
      return [{ description: "Günlük brifinginizi okuyun — gününüzü planlayın (+5 puan)" }];
    },
  },
  {
    task_type: "portfoy_kontrol",
    title: "Portföy kontrolü",
    emoji: "📊",
    command: "portfoyum",
    points: 5,
    check: async (userId) => {
      const supabase = getServiceClient();
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("bot_activity")
        .select("id")
        .eq("user_id", userId)
        .eq("action", "portfoyum")
        .gte("created_at", threeDaysAgo)
        .limit(1);
      if (data?.length) return []; // Checked recently
      return [{ description: "Portföyünüzü 3+ gündür kontrol etmediniz. Göz atın (+5 puan)" }];
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
