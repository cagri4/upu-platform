/**
 * Gamification Triggers — komut tamamlandığında misyon kontrolü
 *
 * Router'dan her komut sonrası çağrılır.
 * İlgili misyonu tamamlar, kullanıcıya tebrik + sonraki görev gösterir.
 */

import { completeMission, updateStreak } from "./engine";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { ensureActiveMission, checkChapterTransition, trackCommandUsed, getQuestState } from "./quest-state";

// ── Mission CTA map ─────────────────────────────────────────────────
// Each mission maps to a hint + single direct-action button.
// Used by both the "next mission" scoreboard popup AND the inactivity
// nudge (for resuming the currently active mission). Quest Director pattern.
export const MISSION_CTA: Record<string, { hint: string; button: { id: string; title: string } }> = {
  // ── Emlak Chapter 1: Çaylak ────────────────────────────────────────
  emlak_c1_mulkekle: { hint: "İlk mülkünüzü ekleyin", button: { id: "cmd:mulkekle", title: "🏠 Mülk Ekle" } },
  emlak_c1_fiyatsor: { hint: "Mülkünüzün fiyatını analiz edin", button: { id: "cmd:fiyatbelirle", title: "📊 Fiyat Belirle" } },
  emlak_c1_brifing: { hint: "Günlük brifinginizi okuyun", button: { id: "cmd:brifing", title: "📋 Brifing" } },
  emlak_c1_paylas: { hint: "Mülkünüzü sosyal medyada paylaşın", button: { id: "cmd:paylas", title: "📱 Paylaş" } },
  emlak_c1_musteri: { hint: "İlk müşterinizi kaydedin", button: { id: "cmd:musteriEkle", title: "🤝 Müşteri Ekle" } },

  // ── Emlak Chapter 2: Öğrenci ───────────────────────────────────────
  emlak_c2_mulkduzenle: { hint: "Mülk bilgilerini tamamlayın", button: { id: "cmd:mulkduzenle", title: "✏️ Bilgileri Düzenle" } },
  emlak_c2_analiz: { hint: "Pazar durumunu inceleyin", button: { id: "cmd:analiz", title: "📊 Pazar Analizi" } },
  emlak_c2_favoriler: { hint: "Favori komutlarınızı ayarlayın", button: { id: "cmd:favoriler", title: "⭐ Favoriler" } },
  emlak_c2_fotograf: { hint: "Mülkünüze fotoğraf yükleyin", button: { id: "cmd:fotograf", title: "📸 Fotoğraf" } },
  emlak_c2_eslestir: { hint: "Müşterinizi mülklerle eşleştirin", button: { id: "cmd:eslestir", title: "🤝 Eşleştir" } },
  emlak_c2_tara: { hint: "Portal linkinden mülk çekin", button: { id: "cmd:tara", title: "🔗 Link Tara" } },
  emlak_c2_webpanel: { hint: "Web paneline giriş yapın", button: { id: "cmd:webpanel", title: "🖥 Web Panel" } },
  emlak_c2_gorevler: { hint: "Bekleyen hatırlatmalarınızı kontrol edin", button: { id: "cmd:gorevler", title: "📋 Görevler" } },
  emlak_c2_uzanti: { hint: "Chrome uzantısını kurun", button: { id: "cmd:uzanti", title: "🔌 Uzantı" } },

  // ── Emlak Chapter 3: Pratisyen ─────────────────────────────────────
  emlak_c3_mulkyonet: { hint: "Mülk yönetim panelini kullanın", button: { id: "cmd:mulkyonet", title: "🏠 Mülk Yönet" } },
  emlak_c3_degerle: { hint: "Mülkünüzün piyasa değerini öğrenin", button: { id: "cmd:degerle", title: "💰 Değerle" } },
  emlak_c3_hatirlatma: { hint: "Hatırlatma kurun", button: { id: "cmd:hatirlatma", title: "⏰ Hatırlatma" } },
  emlak_c3_yayinla: { hint: "Mülklerinizi yayına hazırlayın", button: { id: "cmd:yayinla", title: "📡 Yayınla" } },
  emlak_c3_sunum: { hint: "Müşterinize sunum hazırlayın", button: { id: "cmd:sunum", title: "🎯 Sunum" } },
  emlak_c3_takip: { hint: "Müşterinizi takip edin", button: { id: "cmd:musteriTakip", title: "📞 Müşteri Takip" } },
  emlak_c3_trend: { hint: "Pazar trendini inceleyin", button: { id: "cmd:trend", title: "📈 Trend" } },

  // ── Emlak Chapter 4: Profesyonel ───────────────────────────────────
  emlak_c4_mulkekle2: { hint: "Portföyünüzü 3 mülke çıkarın", button: { id: "cmd:mulkekle", title: "🏠 Mülk Ekle" } },
  emlak_c4_mulkoner: { hint: "Bütçeye göre mülk önerisi alın", button: { id: "cmd:mulkoner", title: "💡 Mülk Öner" } },
  emlak_c4_sozlesme: { hint: "Sözleşme hazırlayın", button: { id: "cmd:sozlesme", title: "📄 Sözleşme" } },
  emlak_c4_websitem: { hint: "Web sitenizi oluşturun", button: { id: "cmd:websitem", title: "🌐 Websitem" } },
  emlak_c4_musteri2: { hint: "2. müşterinizi ekleyin", button: { id: "cmd:musteriEkle", title: "🤝 Müşteri Ekle" } },
  emlak_c4_satistavsiye: { hint: "AI satış stratejisi alın", button: { id: "cmd:satistavsiye", title: "📋 Satış Tavsiye" } },
  emlak_c4_rapor: { hint: "Aylık raporunuzu görün", button: { id: "cmd:rapor", title: "📊 Rapor" } },

  // ── Emlak Chapter 5: Uzman ─────────────────────────────────────────
  emlak_c5_ortakpazar: { hint: "Ortak pazara katılın", button: { id: "cmd:ortakpazar", title: "🏪 Ortak Pazar" } },
  emlak_c5_eslestir2: { hint: "Yeni eşleştirme yapın", button: { id: "cmd:eslestir", title: "🤝 Eşleştir" } },
  emlak_c5_hediyeler: { hint: "Kampanyaları kontrol edin", button: { id: "cmd:hediyeler", title: "🎁 Hediyeler" } },
  emlak_c5_websitem2: { hint: "Web sitenizi kontrol edin", button: { id: "cmd:websitem", title: "🌐 Websitem" } },
  emlak_c5_sunum2: { hint: "2. sunumunuzu hazırlayın", button: { id: "cmd:sunum", title: "🎯 Sunum" } },
  emlak_c5_portfoyum: { hint: "Portföyünüzü gözden geçirin", button: { id: "cmd:portfoyum", title: "📊 Portföyüm" } },

  // ── Bayi — admin ───────────────────────────────────────────────────
  bayi_ilk_urun: { hint: "Kataloğuna ilk ürünü ekle", button: { id: "cmd:yeniurun", title: "📦 Ürün Ekle" } },
  bayi_5_urun: { hint: "Kataloğunu zenginleştir", button: { id: "cmd:yeniurun", title: "📦 Ürün Ekle" } },
  bayi_ilk_davet: { hint: "Bayilerini sisteme davet et", button: { id: "cmd:bayidavet", title: "🏪 Bayi Davet" } },
  bayi_ilk_kampanya: { hint: "Bayilerine kampanya hazırla", button: { id: "cmd:kampanyaolustur", title: "🎯 Kampanya" } },
  bayi_ilk_bildirim: { hint: "Bayilerine duyuru gönder", button: { id: "cmd:duyuru", title: "📢 Duyuru" } },
  bayi_ilk_calisan: { hint: "Ekibini sisteme ekle", button: { id: "cmd:calisanekle", title: "👥 Çalışan Ekle" } },
  bayi_ilk_brifing: { hint: "Günlük brifinginle işlerini takip et", button: { id: "cmd:ozet", title: "📋 Brifing" } },

  // ── Bayi — dealer ─────────────────────────────────────────────────
  dealer_katalog_incele: { hint: "Mevcut ürünleri görüntüle", button: { id: "cmd:urunler", title: "📦 Katalog" } },
  dealer_ilk_siparis: { hint: "İlk siparişini ver", button: { id: "cmd:siparisver", title: "🛒 Sipariş Ver" } },
  dealer_bakiye_kontrol: { hint: "Bakiyeni gör", button: { id: "cmd:bakiyem", title: "💰 Bakiyem" } },
  dealer_fatura_incele: { hint: "Fatura geçmişini görüntüle", button: { id: "cmd:faturalarim", title: "📄 Faturalar" } },
  dealer_kampanya_incele: { hint: "Aktif kampanyaları gör", button: { id: "cmd:aktifkampanyalar", title: "🎯 Kampanyalar" } },
};

// ── Command → Mission mapping ───────────────────────────────────────

// Import bayi mappings
let bayiMissionMap: Record<string, Record<string, string>> | null = null;
async function getBayiMap() {
  if (!bayiMissionMap) {
    const { BAYI_MISSION_MAP } = await import("@/tenants/bayi/gamification");
    bayiMissionMap = BAYI_MISSION_MAP;
  }
  return bayiMissionMap;
}

// ── Command → Mission mapping (new chapter-based system) ───────────
// A command can match MULTIPLE missions across chapters (e.g. mulkekle
// appears in chapter 1 and 4). We resolve by checking which mission_key
// the user's ACTIVE mission matches. If the active mission expects this
// command, complete it. Otherwise check all missions for this command.

/** Maps command/event name → list of mission_keys that this command can satisfy. */
const COMMAND_MISSION_MAP: Record<string, Record<string, string[]>> = {
  emlak: {
    // Custom events (fired from success callbacks, not command open)
    mulk_eklendi: ["emlak_c1_mulkekle", "emlak_c4_mulkekle2"],
    mulk_bilgi_updated: ["emlak_c2_mulkduzenle"],
    mulk_foto_uploaded: ["emlak_c2_fotograf"],

    // ── Router-safe commands (single-step, trigger on open is correct) ──
    brifing: ["emlak_c1_brifing"],
    analiz: ["emlak_c2_analiz"],
    favoriler: ["emlak_c2_favoriler"],
    tara: ["emlak_c2_tara"],
    webpanel: ["emlak_c2_webpanel"],
    gorevler: ["emlak_c2_gorevler"],
    uzanti: ["emlak_c2_uzanti"],
    mulkyonet: ["emlak_c3_mulkyonet"],
    yayinla: ["emlak_c3_yayinla"],
    trend: ["emlak_c3_trend"],
    sozlesme: ["emlak_c4_sozlesme"],
    websitem: ["emlak_c4_websitem", "emlak_c5_websitem2"],
    rapor: ["emlak_c4_rapor"],
    ortakpazar: ["emlak_c5_ortakpazar"],
    hediyeler: ["emlak_c5_hediyeler"],
    portfoyum: ["emlak_c5_portfoyum"],

    // ── Manual-trigger-only (callback/multi-step, trigger from success handler) ──
    // These are NOT triggered by router — only by manual triggerMissionCheck calls
    // in their respective callback/step handlers.
    fiyatbelirle: ["emlak_c1_fiyatsor"],
    fiyatsor: ["emlak_c1_fiyatsor"],  // alias
    paylas: ["emlak_c1_paylas"],
    musteri_eklendi: ["emlak_c1_musteri", "emlak_c4_musteri2"],
    eslestir: ["emlak_c2_eslestir", "emlak_c5_eslestir2"],
    hatirlatma: ["emlak_c3_hatirlatma"],
    sunum: ["emlak_c3_sunum", "emlak_c5_sunum2"],
    takipEt: ["emlak_c3_takip"],
    satistavsiye: ["emlak_c4_satistavsiye"],
    musteriTakip: ["emlak_c3_takip"],
    mulkoner: ["emlak_c4_mulkoner"],
  },
};

// ── Trigger after command execution ─────────────────────────────────

/**
 * @param silent — if true, mission completes and XP is awarded but NO
 *   WhatsApp popup message is sent. Used during field-edit flows where
 *   the popup would interrupt the user's editing loop.
 */
export async function triggerMissionCheck(
  userId: string,
  tenantKey: string,
  commandName: string,
  phone: string,
  silent = false,
): Promise<void> {
  try {
    // Update streak
    const streak = await updateStreak(userId);

    // Track command usage for chapter transition conditions
    await trackCommandUsed(userId, tenantKey, commandName);

    // Ensure user has an active mission (init quest state if needed)
    await ensureActiveMission(userId, tenantKey);

    const supabase = getServiceClient();

    // ── Resolve which mission this command satisfies ──────────────
    let missionKey: string | undefined;

    if (tenantKey === "bayi") {
      const bayiMap = await getBayiMap();
      const { data: prof0 } = await supabase
        .from("profiles").select("role").eq("id", userId).single();
      const userRole = prof0?.role || "admin";
      // Bayi still uses old single-key map
      missionKey = bayiMap?.[userRole]?.[commandName];
    } else {
      const tenantMap = COMMAND_MISSION_MAP[tenantKey];
      const candidates = tenantMap?.[commandName];
      if (!candidates || candidates.length === 0) return;

      // Get user's active mission — if it's one of the candidates, use it.
      // Otherwise try each candidate in order (earliest chapter first).
      const state = await getQuestState(userId, tenantKey);
      if (state.active_mission_key && candidates.includes(state.active_mission_key)) {
        missionKey = state.active_mission_key;
      } else {
        // Try candidates in order — complete the first one that's active/completable
        for (const candidate of candidates) {
          const { data: mission } = await supabase
            .from("platform_missions")
            .select("id, chapter")
            .eq("mission_key", candidate)
            .maybeSingle();

          if (!mission) continue;

          // Only complete missions in current or past chapters
          if (mission.chapter && mission.chapter > state.current_chapter) continue;

          // Check if already completed
          const { data: progress } = await supabase
            .from("user_mission_progress")
            .select("status")
            .eq("user_id", userId)
            .eq("mission_id", mission.id)
            .maybeSingle();

          if (progress?.status === "completed") continue;

          missionKey = candidate;
          break;
        }
      }
    }

    if (!missionKey) return;

    // Try to complete mission
    const result = await completeMission(userId, missionKey);
    if (!result.completed) return;

    // ── Check chapter transition ─────────────────────────────────
    const transition = await checkChapterTransition(userId, tenantKey);

    if (!silent) {
      const sep = "━━━━━━━━━━━━━";
      let msg = `${sep}\n🎮 *İLERLEME*\n`;
      msg += `${result.emoji} ${result.title} ✓\n`;

      // XP info
      const xp = result.xpResult as { xp_added?: number; employee_key?: string; tier_changed?: boolean; new_tier?: number; rank_changed?: boolean; new_rank?: number } | null;
      if (xp?.xp_added && xp.employee_key) {
        const { getEmployee } = await import("./employees");
        const emp = getEmployee(tenantKey, xp.employee_key);
        if (emp) msg += `${emp.icon} ${emp.name} +${xp.xp_added} XP\n`;
      }

      msg += `🔥 Seri: ${streak.current} gün`;
      if (streak.current >= 7) msg += " — harika!";
      else if (streak.current === 1) msg += " — yeni başladın!";
      msg += `\n${sep}`;

      // Tier-up celebration
      if (xp?.tier_changed && xp.new_tier) {
        const { getEmployee, TIER_NAMES, TIER_STARS } = await import("./employees");
        const emp = getEmployee(tenantKey, xp.employee_key!);
        msg += `\n\n🎖 *KADEME ATLADI!*\n${emp?.icon || "⭐"} ${emp?.name || xp.employee_key} → ${TIER_NAMES[xp.new_tier]} ${TIER_STARS[xp.new_tier]}`;
      }

      // Rank-up celebration
      if (xp?.rank_changed && xp.new_rank) {
        const { USER_RANK_NAMES } = await import("./employees");
        msg += `\n\n🏆 *RÜTBE ATLADIN!*\n👤 ${USER_RANK_NAMES[xp.new_rank]}`;
      }

      // ── Chapter completion celebration ───────────────────────────
      if (transition.chapterCompleted && transition.completionMessage) {
        msg += `\n\n${transition.completionMessage}`;
      }

      // ── Next mission CTA (Game Loop: render next frame) ─────────
      if (transition.chapterCompleted && transition.nextMissionKey) {
        // Chapter changed — show next chapter's first mission
        const cta = MISSION_CTA[transition.nextMissionKey];
        if (cta) {
          msg += `\n\n🎯 *Sonraki Görev*\n${cta.hint}`;
          await sendButtons(phone, msg, [cta.button]);
        } else {
          await sendText(phone, msg);
        }
      } else if (transition.isEndgame) {
        msg += "\n\n👑 Tüm bölümleri tamamladın! Artık bir uzman emlak danışmanısın.";
        await sendButtons(phone, msg, [{ id: "cmd:menu", title: "📋 Ana Menü" }]);
      } else if (result.nextMission) {
        // Same chapter — show next mission in chain
        const cta = MISSION_CTA[result.nextMission];
        if (cta) {
          msg += `\n\n🎯 *Sonraki Görev*\n${cta.hint}`;
          await sendButtons(phone, msg, [cta.button]);
        } else {
          await sendText(phone, msg);
        }
      } else {
        // Last mission in chapter but transition hasn't fired yet (edge case)
        await sendText(phone, msg);
      }
    }

    // Check combos
    try {
      const { checkCombos } = await import("./combos");
      const { data: prof2 } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
      if (prof2?.tenant_id) {
        await checkCombos(userId, prof2.tenant_id, tenantKey, missionKey, phone);
      }
    } catch { /* combos are optional */ }
  } catch (err) {
    console.error("[gamification:trigger]", err);
  }
}
