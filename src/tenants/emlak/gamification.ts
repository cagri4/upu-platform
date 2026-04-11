/**
 * Emlak Tenant — Gamification misyon ve görev tanımları
 */
import { getServiceClient } from "@/platform/auth/supabase";

// ── Keşif Misyonları (tek seferlik) ──────────────────────────────────

// ── Mission definitions are now in the database (seeded via SQL migration).
// This array is kept as a reference / fallback for seedEmlakMissions().
// See: supabase/migrations/20260411010000_quest_state_machine.sql
//
// 5 chapters × 34 total missions. Mission keys follow: emlak_c{chapter}_{command}
export const EMLAK_MISSIONS: Array<Record<string, unknown>> = [
  // Chapter 1: Çaylak (5)
  { tenant_key: "emlak", role: "admin", category: "portfoy", mission_key: "emlak_c1_mulkekle", title: "İlk mülkünüzü ekleyin", description: "İlk mülkünüzü ekleyin — link, detaylı form veya hızlı ekleme", emoji: "🏠", points: 15, sort_order: 1, is_repeatable: false, next_mission: "emlak_c1_fiyatsor", employee_key: "portfoy", xp_reward: 15, chapter: 1, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "analiz", mission_key: "emlak_c1_fiyatsor", title: "Bölge fiyatını öğrenin", description: "Bölgenizdeki fiyat aralığını öğrenin — min/ort/max ve m² fiyatı", emoji: "📊", points: 15, sort_order: 2, is_repeatable: false, next_mission: "emlak_c1_brifing", employee_key: "analist", xp_reward: 15, chapter: 1, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon", mission_key: "emlak_c1_brifing", title: "Brifinginizi okuyun", description: "Günlük brifinginizi okuyun — mülk, müşteri, hatırlatma özeti", emoji: "📋", points: 5, sort_order: 3, is_repeatable: false, next_mission: "emlak_c1_paylas", employee_key: "sekreter", xp_reward: 5, chapter: 1, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya", mission_key: "emlak_c1_paylas", title: "Mülkünüzü paylaşın", description: "Mülkünüz için Instagram paylaşım metni oluşturun — hashtag'li", emoji: "📱", points: 10, sort_order: 4, is_repeatable: false, next_mission: "emlak_c1_musteri", employee_key: "medya", xp_reward: 10, chapter: 1, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c1_musteri", title: "İlk müşterinizi ekleyin", description: "İlk müşterinizi kaydedin — isim, bütçe, tercihler. Otomatik eşleşme", emoji: "🤝", points: 20, sort_order: 5, is_repeatable: false, next_mission: null, employee_key: "satis", xp_reward: 20, chapter: 1, chapter_order: 5 },

  // Chapter 2: Öğrenci (9)
  { tenant_key: "emlak", role: "admin", category: "portfoy", mission_key: "emlak_c2_mulkduzenle", title: "Mülk bilgilerini tamamlayın", description: "Mülkünüzün eksik bilgilerini tamamlayın — alan, oda, kat, fiyat", emoji: "📝", points: 15, sort_order: 6, is_repeatable: false, next_mission: "emlak_c2_analiz", employee_key: "portfoy", xp_reward: 15, chapter: 2, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "analiz", mission_key: "emlak_c2_analiz", title: "Pazar durumunu inceleyin", description: "Pazar durumunu inceleyin — toplam ilan sayısı, şehir bazlı dağılım", emoji: "📊", points: 10, sort_order: 7, is_repeatable: false, next_mission: "emlak_c2_favoriler", employee_key: "analist", xp_reward: 10, chapter: 2, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon", mission_key: "emlak_c2_favoriler", title: "Favorilerinizi ayarlayın", description: "En çok kullandığınız komutları favorilere ekleyin — hızlı erişim", emoji: "⭐", points: 5, sort_order: 8, is_repeatable: false, next_mission: "emlak_c2_fotograf", employee_key: "sekreter", xp_reward: 5, chapter: 2, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya", mission_key: "emlak_c2_fotograf", title: "Fotoğraf ekleyin", description: "Mülkünüze WhatsApp'tan fotoğraf gönderin — telefondan direkt yükleyin", emoji: "📸", points: 15, sort_order: 9, is_repeatable: false, next_mission: "emlak_c2_eslestir", employee_key: "medya", xp_reward: 15, chapter: 2, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c2_eslestir", title: "Müşteri eşleştirin", description: "Müşterinizi mülklerle eşleştirin — bütçe, lokasyon, tip uyumu puanlanır", emoji: "🤝", points: 20, sort_order: 10, is_repeatable: false, next_mission: "emlak_c2_tara", employee_key: "satis", xp_reward: 20, chapter: 2, chapter_order: 5 },
  { tenant_key: "emlak", role: "admin", category: "portfoy", mission_key: "emlak_c2_tara", title: "Linkten mülk çekin", description: "Sahibinden/Hepsiemlak linkini yapıştırın — mülk otomatik portföyünüze eklensin", emoji: "🔗", points: 15, sort_order: 11, is_repeatable: false, next_mission: "emlak_c2_webpanel", employee_key: "portfoy", xp_reward: 15, chapter: 2, chapter_order: 6 },
  { tenant_key: "emlak", role: "admin", category: "analiz", mission_key: "emlak_c2_webpanel", title: "Web paneline girin", description: "Web paneline giriş yapın — 15 dk geçerli magic link ile büyük ekrandan bakın", emoji: "🖥", points: 5, sort_order: 12, is_repeatable: false, next_mission: "emlak_c2_gorevler", employee_key: "analist", xp_reward: 5, chapter: 2, chapter_order: 7 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon", mission_key: "emlak_c2_gorevler", title: "Görevlerinizi kontrol edin", description: "Bekleyen hatırlatmalarınızı kontrol edin — bugün ne yapmanız gerekiyor?", emoji: "📋", points: 5, sort_order: 13, is_repeatable: false, next_mission: "emlak_c2_uzanti", employee_key: "sekreter", xp_reward: 5, chapter: 2, chapter_order: 8 },
  { tenant_key: "emlak", role: "admin", category: "medya", mission_key: "emlak_c2_uzanti", title: "Chrome uzantısını kurun", description: "Chrome uzantısını kurun — WhatsApp'ta hazırladığınız mülkleri Sahibinden'e yükleyin", emoji: "🔌", points: 10, sort_order: 14, is_repeatable: false, next_mission: null, employee_key: "medya", xp_reward: 10, chapter: 2, chapter_order: 9 },

  // Chapter 3: Pratisyen (7)
  { tenant_key: "emlak", role: "admin", category: "portfoy", mission_key: "emlak_c3_mulkyonet", title: "Mülk yönetim panelini kullanın", description: "Mülk yönetim panelini kullanın — düzenle, durum değiştir, AI açıklama yazdır", emoji: "🏠", points: 15, sort_order: 15, is_repeatable: false, next_mission: "emlak_c3_degerle", employee_key: "portfoy", xp_reward: 15, chapter: 3, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "analiz", mission_key: "emlak_c3_degerle", title: "Piyasa değerini öğrenin", description: "Mülkünüzün piyasa değerini öğrenin — benzer ilanlarla karşılaştırma ve AI analizi", emoji: "💰", points: 15, sort_order: 16, is_repeatable: false, next_mission: "emlak_c3_hatirlatma", employee_key: "analist", xp_reward: 15, chapter: 3, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon", mission_key: "emlak_c3_hatirlatma", title: "Hatırlatma kurun", description: "İlk hatırlatmanızı kurun — ev gezdirme, telefon veya teklif için tarih seçin", emoji: "⏰", points: 15, sort_order: 17, is_repeatable: false, next_mission: "emlak_c3_yayinla", employee_key: "sekreter", xp_reward: 15, chapter: 3, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya", mission_key: "emlak_c3_yayinla", title: "Yayın hazırlığını kontrol edin", description: "Mülklerin yayın hazırlığını kontrol edin — eksik bilgileri görün, portala yükleyin", emoji: "📡", points: 15, sort_order: 18, is_repeatable: false, next_mission: "emlak_c3_sunum", employee_key: "medya", xp_reward: 15, chapter: 3, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c3_sunum", title: "Sunum hazırlayın", description: "Müşterinize özel sunum hazırlayın — mülk seçin, AI kişiselleştirsin, magic link gönderin", emoji: "🎯", points: 25, sort_order: 19, is_repeatable: false, next_mission: "emlak_c3_takip", employee_key: "satis", xp_reward: 25, chapter: 3, chapter_order: 5 },
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c3_takip", title: "Piyasa takibi kurun", description: "Piyasa takibi kurun — tip, bütçe, bölge belirleyin, her sabah yeni ilanlar bildirilsin", emoji: "📡", points: 25, sort_order: 20, is_repeatable: false, next_mission: "emlak_c3_trend", employee_key: "satis", xp_reward: 25, chapter: 3, chapter_order: 6 },
  { tenant_key: "emlak", role: "admin", category: "analiz", mission_key: "emlak_c3_trend", title: "Pazar trendini inceleyin", description: "Pazar trendini inceleyin — tip dağılımı, ortalama fiyatlar, son 7 günün hareketi", emoji: "📈", points: 10, sort_order: 21, is_repeatable: false, next_mission: null, employee_key: "analist", xp_reward: 10, chapter: 3, chapter_order: 7 },

  // Chapter 4: Profesyonel (7)
  { tenant_key: "emlak", role: "admin", category: "portfoy", mission_key: "emlak_c4_mulkekle2", title: "Portföyünüzü büyütün", description: "Portföyünüzü 3 mülke çıkarın — 15-25 ilan arası ideal", emoji: "🏠", points: 15, sort_order: 22, is_repeatable: false, next_mission: "emlak_c4_mulkoner", employee_key: "portfoy", xp_reward: 15, chapter: 4, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "analiz", mission_key: "emlak_c4_mulkoner", title: "Mülk önerisi alın", description: "Müşterinizin bütçesine göre mülk önerisi alın — uygun ve esnetilebilir sonuçlar", emoji: "💡", points: 15, sort_order: 23, is_repeatable: false, next_mission: "emlak_c4_sozlesme", employee_key: "analist", xp_reward: 15, chapter: 4, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon", mission_key: "emlak_c4_sozlesme", title: "Sözleşme hazırlayın", description: "Yetkilendirme sözleşmesi hazırlayın — sahibi bilgileri, komisyon, süre, imza linki", emoji: "📄", points: 25, sort_order: 24, is_repeatable: false, next_mission: "emlak_c4_websitem", employee_key: "sekreter", xp_reward: 25, chapter: 4, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya", mission_key: "emlak_c4_websitem", title: "Web sitenizi oluşturun", description: "Profesyonel web sitenizi oluşturun — isim, slogan, bio, tema seçin, AI yardımcı", emoji: "🌐", points: 10, sort_order: 25, is_repeatable: false, next_mission: "emlak_c4_musteri2", employee_key: "medya", xp_reward: 10, chapter: 4, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c4_musteri2", title: "2. müşterinizi ekleyin", description: "2. müşterinizi ekleyin — satışların %82'si müşteri ağından, ağınızı büyütün", emoji: "🤝", points: 20, sort_order: 26, is_repeatable: false, next_mission: "emlak_c4_satistavsiye", employee_key: "satis", xp_reward: 20, chapter: 4, chapter_order: 5 },
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c4_satistavsiye", title: "Satış stratejisi alın", description: "Mülkünüz için AI satış stratejisi alın — fiyatlama, pazarlama önerileri", emoji: "📋", points: 15, sort_order: 27, is_repeatable: false, next_mission: "emlak_c4_rapor", employee_key: "satis", xp_reward: 15, chapter: 4, chapter_order: 6 },
  { tenant_key: "emlak", role: "admin", category: "analiz", mission_key: "emlak_c4_rapor", title: "Aylık raporunuzu görün", description: "Aylık raporunuzu görün — mülk, müşteri, sözleşme özeti", emoji: "📊", points: 10, sort_order: 28, is_repeatable: false, next_mission: null, employee_key: "analist", xp_reward: 10, chapter: 4, chapter_order: 7 },

  // Chapter 5: Uzman (6)
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c5_ortakpazar", title: "Ortak pazara katılın", description: "Mülklerinizi diğer danışmanlarla paylaşın — ağınızı büyütün, gelen ilanları görün", emoji: "🏪", points: 20, sort_order: 29, is_repeatable: false, next_mission: "emlak_c5_eslestir2", employee_key: "satis", xp_reward: 20, chapter: 5, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c5_eslestir2", title: "Yeni eşleştirme yapın", description: "Yeni müşterinizi eşleştirin — satışların %80'i 5-12. temasta kapanıyor", emoji: "🤝", points: 20, sort_order: 30, is_repeatable: false, next_mission: "emlak_c5_hediyeler", employee_key: "satis", xp_reward: 20, chapter: 5, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon", mission_key: "emlak_c5_hediyeler", title: "Kampanyaları kontrol edin", description: "Aktif kampanyaları kontrol edin — müşterilerinize özel fırsatlar sunun", emoji: "🎁", points: 5, sort_order: 31, is_repeatable: false, next_mission: "emlak_c5_websitem2", employee_key: "sekreter", xp_reward: 5, chapter: 5, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya", mission_key: "emlak_c5_websitem2", title: "Web sitenizi kontrol edin", description: "Web sitenizi kontrol edin — eksik var mı? Müşterinize linkini gönderin", emoji: "🌐", points: 10, sort_order: 32, is_repeatable: false, next_mission: "emlak_c5_sunum2", employee_key: "medya", xp_reward: 10, chapter: 5, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri", mission_key: "emlak_c5_sunum2", title: "2. sunumunuzu hazırlayın", description: "2. sunumunuzu hazırlayın — üst düzey danışmanlar haftada 2-4 sunum yapıyor", emoji: "🎯", points: 25, sort_order: 33, is_repeatable: false, next_mission: "emlak_c5_portfoyum", employee_key: "satis", xp_reward: 25, chapter: 5, chapter_order: 5 },
  { tenant_key: "emlak", role: "admin", category: "portfoy", mission_key: "emlak_c5_portfoyum", title: "Portföyünüzü gözden geçirin", description: "Portföyünüzü gözden geçirin — üst düzey danışmanlar her gün portföy kontrolü yapar", emoji: "📊", points: 5, sort_order: 34, is_repeatable: false, next_mission: null, employee_key: "portfoy", xp_reward: 5, chapter: 5, chapter_order: 6 },
];

// ── Görev Kuralları (tekrarlayan, veri bazlı) ────────────────────────

export interface TaskRule {
  task_type: string;
  title: string;
  emoji: string;
  command: string;
  points: number;
  employee_key: string;   // which virtual employee this task belongs to
  xp_reward: number;      // XP awarded on completion
  check: (userId: string, tenantId: string) => Promise<Array<{ entityId?: string; description: string }>>;
}

export const EMLAK_TASK_RULES: TaskRule[] = [
  {
    task_type: "mulk_guncelle",
    title: "Mülk güncelle",
    emoji: "🏠",
    command: "mulkyonet",
    points: 5,
    employee_key: "portfoy",
    xp_reward: 5,
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
    employee_key: "portfoy",
    xp_reward: 10,
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
    employee_key: "satis",
    xp_reward: 10,
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
    employee_key: "satis",
    xp_reward: 15,
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
    employee_key: "portfoy",
    xp_reward: 10,
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
    employee_key: "analist",
    xp_reward: 10,
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
    employee_key: "sekreter",
    xp_reward: 5,
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
    employee_key: "portfoy",
    xp_reward: 5,
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
