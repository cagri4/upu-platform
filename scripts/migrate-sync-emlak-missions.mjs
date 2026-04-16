#!/usr/bin/env node
/**
 * Full sync: emlak platform_missions rows ↔ EMLAK_MISSIONS code definition.
 *
 * Existing seedEmlakMissions only INSERTs new rows — never updates. Result:
 * whenever a mission chain changes in code, DB drifts until a row is reseeded.
 *
 * This script:
 *   - Upserts every EMLAK_MISSIONS row (full field coverage)
 *   - Deletes any platform_missions row for emlak/admin not present in code
 *   - Resets any user_quest_state.active_mission_key pointing to a deleted row
 *
 * Run once after structural mission changes. Safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import { register } from "module";

const env = readFileSync("/home/cagr/Masaüstü/upu-platform/.env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();
const sb = createClient(url, key);

// Hard-coded copy of EMLAK_MISSIONS source of truth (tenant_key=emlak, role=admin)
// Mirror of src/tenants/emlak/gamification.ts
const EMLAK_MISSIONS = [
  // C1
  { tenant_key: "emlak", role: "admin", category: "portfoy",       mission_key: "emlak_c1_mulkekle",  title: "İlk mülkünüzü ekleyin",               description: "İlk mülkünüzü ekleyin — link, detaylı form veya hızlı ekleme",                                       emoji: "🏠", points: 15, sort_order:  1, is_repeatable: false, next_mission: "emlak_c1_fiyatsor",   employee_key: "portfoy",  xp_reward: 15, chapter: 1, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "analiz",        mission_key: "emlak_c1_fiyatsor",  title: "Bölge fiyatını öğrenin",              description: "Bölgenizdeki fiyat aralığını öğrenin — min/ort/max ve m² fiyatı",                                    emoji: "📊", points: 15, sort_order:  2, is_repeatable: false, next_mission: "emlak_c1_brifing",    employee_key: "analist",  xp_reward: 15, chapter: 1, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon",  mission_key: "emlak_c1_brifing",   title: "Brifinginizi okuyun",                 description: "Günlük brifinginizi okuyun — mülk, müşteri, hatırlatma özeti",                                        emoji: "📋", points:  5, sort_order:  3, is_repeatable: false, next_mission: "emlak_c1_paylas",     employee_key: "sekreter", xp_reward:  5, chapter: 1, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya",         mission_key: "emlak_c1_paylas",    title: "Mülkünüzü paylaşın",                  description: "Mülkünüz için Instagram paylaşım metni oluşturun — hashtag'li",                                       emoji: "📱", points: 10, sort_order:  4, is_repeatable: false, next_mission: "emlak_c1_musteri",    employee_key: "medya",    xp_reward: 10, chapter: 1, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c1_musteri",   title: "İlk müşterinizi ekleyin",             description: "İlk müşterinizi kaydedin — isim, bütçe, tercihler. Otomatik eşleşme",                                 emoji: "🤝", points: 20, sort_order:  5, is_repeatable: false, next_mission: null,                  employee_key: "satis",    xp_reward: 20, chapter: 1, chapter_order: 5 },
  // C2
  { tenant_key: "emlak", role: "admin", category: "portfoy",       mission_key: "emlak_c2_mulkduzenle", title: "Mülk bilgilerini tamamlayın",       description: "Mülkünüzün eksik bilgilerini tamamlayın — alan, oda, kat, fiyat",                                     emoji: "📝", points: 15, sort_order:  6, is_repeatable: false, next_mission: "emlak_c2_analiz",     employee_key: "portfoy",  xp_reward: 15, chapter: 2, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "analiz",        mission_key: "emlak_c2_analiz",    title: "Pazar durumunu inceleyin",            description: "Pazar durumunu inceleyin — toplam ilan sayısı, şehir bazlı dağılım",                                  emoji: "📊", points: 10, sort_order:  7, is_repeatable: false, next_mission: "emlak_c2_favoriler",  employee_key: "analist",  xp_reward: 10, chapter: 2, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon",  mission_key: "emlak_c2_favoriler", title: "Favorilerinizi ayarlayın",            description: "En çok kullandığınız komutları favorilere ekleyin — hızlı erişim",                                    emoji: "⭐", points:  5, sort_order:  8, is_repeatable: false, next_mission: "emlak_c2_fotograf",   employee_key: "sekreter", xp_reward:  5, chapter: 2, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya",         mission_key: "emlak_c2_fotograf",  title: "Fotoğraf ekleyin",                    description: "Mülkünüze WhatsApp'tan fotoğraf gönderin — telefondan direkt yükleyin",                               emoji: "📸", points: 15, sort_order:  9, is_repeatable: false, next_mission: "emlak_c2_eslestir",   employee_key: "medya",    xp_reward: 15, chapter: 2, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c2_eslestir",  title: "Müşteri eşleştirin",                  description: "Müşterinizi mülklerle eşleştirin — bütçe, lokasyon, tip uyumu puanlanır",                             emoji: "🤝", points: 20, sort_order: 10, is_repeatable: false, next_mission: "emlak_c2_tara",       employee_key: "satis",    xp_reward: 20, chapter: 2, chapter_order: 5 },
  { tenant_key: "emlak", role: "admin", category: "portfoy",       mission_key: "emlak_c2_tara",      title: "Linkten mülk çekin",                  description: "Sahibinden/Hepsiemlak linkini yapıştırın — mülk otomatik portföyünüze eklensin",                      emoji: "🔗", points: 15, sort_order: 11, is_repeatable: false, next_mission: "emlak_c2_gorevler",   employee_key: "portfoy",  xp_reward: 15, chapter: 2, chapter_order: 6 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon",  mission_key: "emlak_c2_gorevler",  title: "Görevlerinizi kontrol edin",          description: "Bekleyen hatırlatmalarınızı kontrol edin — bugün ne yapmanız gerekiyor?",                             emoji: "📋", points:  5, sort_order: 12, is_repeatable: false, next_mission: "emlak_c2_uzanti",     employee_key: "sekreter", xp_reward:  5, chapter: 2, chapter_order: 7 },
  { tenant_key: "emlak", role: "admin", category: "medya",         mission_key: "emlak_c2_uzanti",    title: "Chrome uzantısını kurun",             description: "Chrome uzantısını kurun — WhatsApp'ta hazırladığınız mülkleri Sahibinden'e yükleyin",                 emoji: "🔌", points: 10, sort_order: 13, is_repeatable: false, next_mission: null,                  employee_key: "medya",    xp_reward: 10, chapter: 2, chapter_order: 8 },
  // C3
  { tenant_key: "emlak", role: "admin", category: "portfoy",       mission_key: "emlak_c3_mulkyonet", title: "Mülk yönetim panelini kullanın",      description: "Mülk yönetim panelini kullanın — düzenle, durum değiştir, AI açıklama yazdır",                        emoji: "🏠", points: 15, sort_order: 14, is_repeatable: false, next_mission: "emlak_c3_degerle",    employee_key: "portfoy",  xp_reward: 15, chapter: 3, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "analiz",        mission_key: "emlak_c3_degerle",   title: "Piyasa değerini öğrenin",             description: "Mülkünüzün piyasa değerini öğrenin — benzer ilanlarla karşılaştırma ve AI analizi",                   emoji: "💰", points: 15, sort_order: 15, is_repeatable: false, next_mission: "emlak_c3_hatirlatma", employee_key: "analist",  xp_reward: 15, chapter: 3, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon",  mission_key: "emlak_c3_hatirlatma",title: "Hatırlatma kurun",                    description: "İlk hatırlatmanızı kurun — ev gezdirme, telefon veya teklif için tarih seçin",                        emoji: "⏰", points: 15, sort_order: 16, is_repeatable: false, next_mission: "emlak_c3_yayinla",    employee_key: "sekreter", xp_reward: 15, chapter: 3, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya",         mission_key: "emlak_c3_yayinla",   title: "Yayın hazırlığını kontrol edin",      description: "Mülklerin yayın hazırlığını kontrol edin — eksik bilgileri görün, portala yükleyin",                  emoji: "📡", points: 15, sort_order: 17, is_repeatable: false, next_mission: "emlak_c3_sunum",      employee_key: "medya",    xp_reward: 15, chapter: 3, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c3_sunum",     title: "Sunum hazırlayın",                    description: "Müşterinize özel sunum hazırlayın — mülk seçin, AI kişiselleştirsin, magic link gönderin",            emoji: "🎯", points: 25, sort_order: 18, is_repeatable: false, next_mission: "emlak_c3_takip",      employee_key: "satis",    xp_reward: 25, chapter: 3, chapter_order: 5 },
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c3_takip",     title: "Piyasa takibi kurun",                 description: "Piyasa takibi kurun — tip, bütçe, bölge belirleyin, her sabah yeni ilanlar bildirilsin",              emoji: "📡", points: 25, sort_order: 19, is_repeatable: false, next_mission: "emlak_c3_trend",      employee_key: "satis",    xp_reward: 25, chapter: 3, chapter_order: 6 },
  { tenant_key: "emlak", role: "admin", category: "analiz",        mission_key: "emlak_c3_trend",     title: "Pazar trendini inceleyin",            description: "Pazar trendini inceleyin — tip dağılımı, ortalama fiyatlar, son 7 günün hareketi",                    emoji: "📈", points: 10, sort_order: 20, is_repeatable: false, next_mission: "emlak_c3_webpanel",   employee_key: "analist",  xp_reward: 10, chapter: 3, chapter_order: 7 },
  { tenant_key: "emlak", role: "admin", category: "analiz",        mission_key: "emlak_c3_webpanel",  title: "Web paneline girin",                  description: "Portföyünüzü büyük ekrandan görüntüleyin — 15 dk geçerli magic link ile mülk/müşteri listenizi inceleyin", emoji: "🖥", points: 10, sort_order: 21, is_repeatable: false, next_mission: null,                  employee_key: "analist",  xp_reward: 10, chapter: 3, chapter_order: 8 },
  // C4
  { tenant_key: "emlak", role: "admin", category: "portfoy",       mission_key: "emlak_c4_mulkekle2", title: "Portföyünüzü büyütün",                description: "Portföyünüzü 3 mülke çıkarın — 15-25 ilan arası ideal",                                               emoji: "🏠", points: 15, sort_order: 22, is_repeatable: false, next_mission: "emlak_c4_mulkoner",   employee_key: "portfoy",  xp_reward: 15, chapter: 4, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "analiz",        mission_key: "emlak_c4_mulkoner",  title: "Mülk önerisi alın",                   description: "Müşterinizin bütçesine göre mülk önerisi alın — uygun ve esnetilebilir sonuçlar",                     emoji: "💡", points: 15, sort_order: 23, is_repeatable: false, next_mission: "emlak_c4_sozlesme",   employee_key: "analist",  xp_reward: 15, chapter: 4, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon",  mission_key: "emlak_c4_sozlesme",  title: "Sözleşme hazırlayın",                 description: "Yetkilendirme sözleşmesi hazırlayın — sahibi bilgileri, komisyon, süre, imza linki",                  emoji: "📄", points: 25, sort_order: 24, is_repeatable: false, next_mission: "emlak_c4_websitem",   employee_key: "sekreter", xp_reward: 25, chapter: 4, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya",         mission_key: "emlak_c4_websitem",  title: "Web sitenizi oluşturun",              description: "Profesyonel web sitenizi oluşturun — isim, slogan, bio, tema seçin, AI yardımcı",                     emoji: "🌐", points: 10, sort_order: 25, is_repeatable: false, next_mission: "emlak_c4_musteri2",   employee_key: "medya",    xp_reward: 10, chapter: 4, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c4_musteri2",  title: "2. müşterinizi ekleyin",              description: "2. müşterinizi ekleyin — satışların %82'si müşteri ağından, ağınızı büyütün",                         emoji: "🤝", points: 20, sort_order: 26, is_repeatable: false, next_mission: "emlak_c4_satistavsiye", employee_key: "satis",   xp_reward: 20, chapter: 4, chapter_order: 5 },
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c4_satistavsiye", title: "Satış stratejisi alın",            description: "Mülkünüz için AI satış stratejisi alın — fiyatlama, pazarlama önerileri",                             emoji: "📋", points: 15, sort_order: 27, is_repeatable: false, next_mission: "emlak_c4_rapor",      employee_key: "satis",    xp_reward: 15, chapter: 4, chapter_order: 6 },
  { tenant_key: "emlak", role: "admin", category: "analiz",        mission_key: "emlak_c4_rapor",     title: "Aylık raporunuzu görün",              description: "Aylık raporunuzu görün — mülk, müşteri, sözleşme özeti",                                              emoji: "📊", points: 10, sort_order: 28, is_repeatable: false, next_mission: null,                  employee_key: "analist",  xp_reward: 10, chapter: 4, chapter_order: 7 },
  // C5
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c5_ortakpazar",title: "Ortak pazara katılın",                description: "Mülklerinizi diğer danışmanlarla paylaşın — ağınızı büyütün, gelen ilanları görün",                    emoji: "🏪", points: 20, sort_order: 29, is_repeatable: false, next_mission: "emlak_c5_eslestir2",  employee_key: "satis",    xp_reward: 20, chapter: 5, chapter_order: 1 },
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c5_eslestir2", title: "Yeni eşleştirme yapın",               description: "Yeni müşterinizi eşleştirin — satışların %80'i 5-12. temasta kapanıyor",                              emoji: "🤝", points: 20, sort_order: 30, is_repeatable: false, next_mission: "emlak_c5_hediyeler",  employee_key: "satis",    xp_reward: 20, chapter: 5, chapter_order: 2 },
  { tenant_key: "emlak", role: "admin", category: "organizasyon",  mission_key: "emlak_c5_hediyeler", title: "Kampanyaları kontrol edin",           description: "Aktif kampanyaları kontrol edin — müşterilerinize özel fırsatlar sunun",                              emoji: "🎁", points:  5, sort_order: 31, is_repeatable: false, next_mission: "emlak_c5_websitem2",  employee_key: "sekreter", xp_reward:  5, chapter: 5, chapter_order: 3 },
  { tenant_key: "emlak", role: "admin", category: "medya",         mission_key: "emlak_c5_websitem2", title: "Web sitenizi kontrol edin",           description: "Web sitenizi kontrol edin — eksik var mı? Müşterinize linkini gönderin",                              emoji: "🌐", points: 10, sort_order: 32, is_repeatable: false, next_mission: "emlak_c5_sunum2",     employee_key: "medya",    xp_reward: 10, chapter: 5, chapter_order: 4 },
  { tenant_key: "emlak", role: "admin", category: "musteri",       mission_key: "emlak_c5_sunum2",    title: "2. sunumunuzu hazırlayın",            description: "2. sunumunuzu hazırlayın — üst düzey danışmanlar haftada 2-4 sunum yapıyor",                          emoji: "🎯", points: 25, sort_order: 33, is_repeatable: false, next_mission: "emlak_c5_portfoyum",  employee_key: "satis",    xp_reward: 25, chapter: 5, chapter_order: 5 },
  { tenant_key: "emlak", role: "admin", category: "portfoy",       mission_key: "emlak_c5_portfoyum", title: "Portföyünüzü gözden geçirin",         description: "Portföyünüzü gözden geçirin — üst düzey danışmanlar her gün portföy kontrolü yapar",                  emoji: "📊", points:  5, sort_order: 34, is_repeatable: false, next_mission: null,                  employee_key: "portfoy",  xp_reward:  5, chapter: 5, chapter_order: 6 },
];

const validKeys = new Set(EMLAK_MISSIONS.map((m) => m.mission_key));

async function main() {
  console.log("▶ Full sync of emlak platform_missions → code");

  // 1. Upsert each row
  for (const m of EMLAK_MISSIONS) {
    const { data: existing } = await sb
      .from("platform_missions")
      .select("id")
      .eq("mission_key", m.mission_key)
      .maybeSingle();

    if (existing) {
      await sb.from("platform_missions").update(m).eq("id", existing.id);
      console.log(`  ↺ updated ${m.mission_key}`);
    } else {
      await sb.from("platform_missions").insert(m);
      console.log(`  + inserted ${m.mission_key}`);
    }
  }

  // 2. Delete any emlak/admin mission not in code
  const { data: allInDb } = await sb
    .from("platform_missions")
    .select("id, mission_key")
    .eq("tenant_key", "emlak")
    .eq("role", "admin");

  const orphans = (allInDb || []).filter((r) => !validKeys.has(r.mission_key));
  for (const o of orphans) {
    // Clear user progress first (FK)
    const { count: progCount } = await sb
      .from("user_mission_progress")
      .delete({ count: "exact" })
      .eq("mission_id", o.id);
    await sb.from("platform_missions").delete().eq("id", o.id);
    console.log(`  ✗ deleted orphan ${o.mission_key} (+${progCount || 0} user progress rows)`);
  }

  // 3. Reset quest states pointing to deleted missions
  const { data: states } = await sb
    .from("user_quest_state")
    .select("user_id, active_mission_key")
    .eq("tenant_key", "emlak");

  let resetCount = 0;
  for (const s of states || []) {
    if (s.active_mission_key && !validKeys.has(s.active_mission_key)) {
      await sb.from("user_quest_state")
        .update({ active_mission_key: null })
        .eq("user_id", s.user_id)
        .eq("tenant_key", "emlak");
      resetCount++;
    }
  }
  if (resetCount > 0) console.log(`  ↻ reset ${resetCount} quest state(s) pointing to deleted missions`);

  console.log("✅ Sync complete");
}

main().catch((e) => { console.error("✗", e); process.exit(1); });
