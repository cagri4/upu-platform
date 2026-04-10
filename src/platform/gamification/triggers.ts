/**
 * Gamification Triggers — komut tamamlandığında misyon kontrolü
 *
 * Router'dan her komut sonrası çağrılır.
 * İlgili misyonu tamamlar, kullanıcıya tebrik + sonraki görev gösterir.
 */

import { completeMission, updateStreak } from "./engine";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── Mission CTA map ─────────────────────────────────────────────────
// Each mission maps to a hint + single direct-action button.
// Used by both the "next mission" scoreboard popup AND the inactivity
// nudge (for resuming the currently active mission). Quest Director pattern.
export const MISSION_CTA: Record<string, { hint: string; button: { id: string; title: string } }> = {
  // Emlak — first mission
  emlak_ilk_mulk: {
    hint: "Portföyüne ilk mülkü ekle",
    button: { id: "cmd:mulkekle", title: "🏠 Mülk Ekle" },
  },
  // Emlak — portföy chain
  emlak_mulk_bilgi_tamamla: {
    hint: "Mülkün bilgilerini tamamla — fiyat, m², oda sayısı",
    button: { id: "cmd:mulkduzenle", title: "✏️ Bilgileri Düzenle" },
  },
  emlak_mulk_foto: {
    hint: "Mülke fotoğraf ekle — fotoğraflı ilanlar 70% daha çok ilgi görür",
    button: { id: "cmd:fotograf", title: "📸 Fotoğraf Ekle" },
  },
  emlak_fiyat_kontrol: {
    hint: "Piyasa fiyatını kontrol et — doğru fiyat = hızlı satış",
    button: { id: "cmd:fiyatsor", title: "💰 Fiyat Sor" },
  },
  // Emlak — müşteri chain
  emlak_ilk_musteri: {
    hint: "İlk müşterini ekle — eşleştirmeye başla",
    button: { id: "cmd:musteriEkle", title: "👤 Müşteri Ekle" },
  },
  emlak_ilk_eslestirme: {
    hint: "Müşterini uygun mülklerle eşleştir",
    button: { id: "cmd:eslestir", title: "🤝 Eşleştir" },
  },
  emlak_ilk_sunum: {
    hint: "Müşterine profesyonel bir sunum hazırla",
    button: { id: "cmd:sunum", title: "🎯 Sunum Hazırla" },
  },
  emlak_ilk_takip: {
    hint: "Sunum sonrası müşterini takip et",
    button: { id: "cmd:takipEt", title: "📞 Takip Et" },
  },
  // Emlak — analiz/brifing/paylas
  emlak_ilk_analiz: {
    hint: "Bölgenin pazar durumunu incele",
    button: { id: "cmd:analiz", title: "📊 Pazar Analizi" },
  },
  emlak_ilk_brifing: {
    hint: "Günlük brifinginle gününü planla",
    button: { id: "cmd:brifing", title: "📋 Brifing" },
  },
  emlak_ilk_paylas: {
    hint: "Mülkünü sosyal medyada paylaş",
    button: { id: "cmd:paylas", title: "📱 Paylaş" },
  },

  // Bayi — admin first mission
  bayi_ilk_urun: {
    hint: "Kataloğuna ilk ürünü ekle",
    button: { id: "cmd:yeniurun", title: "📦 Ürün Ekle" },
  },
  // Bayi admin chain
  bayi_5_urun: {
    hint: "Kataloğunu zenginleştir — daha çok ürün, daha çok sipariş",
    button: { id: "cmd:yeniurun", title: "📦 Ürün Ekle" },
  },
  bayi_ilk_davet: {
    hint: "Bayilerini sisteme davet et",
    button: { id: "cmd:bayidavet", title: "🏪 Bayi Davet" },
  },
  bayi_ilk_kampanya: {
    hint: "Bayilerine özel kampanya hazırla",
    button: { id: "cmd:kampanyaolustur", title: "🎯 Kampanya" },
  },
  bayi_ilk_bildirim: {
    hint: "Bayilerine duyuru veya bildirim gönder",
    button: { id: "cmd:duyuru", title: "📢 Duyuru" },
  },
  bayi_ilk_calisan: {
    hint: "Ekibini sisteme ekle",
    button: { id: "cmd:calisanekle", title: "👥 Çalışan Ekle" },
  },
  bayi_ilk_brifing: {
    hint: "Günlük brifinginle işlerini takip et",
    button: { id: "cmd:ozet", title: "📋 Brifing" },
  },

  // Bayi — dealer first mission
  dealer_katalog_incele: {
    hint: "Mevcut ürünleri ve fiyatları görüntüle",
    button: { id: "cmd:urunler", title: "📦 Katalog" },
  },
  // Bayi dealer chain
  dealer_ilk_siparis: {
    hint: "Katalogdan ürün seçerek ilk siparişini ver",
    button: { id: "cmd:siparisver", title: "🛒 Sipariş Ver" },
  },
  dealer_bakiye_kontrol: {
    hint: "Güncel bakiyeni ve borç durumunu gör",
    button: { id: "cmd:bakiyem", title: "💰 Bakiyem" },
  },
  dealer_fatura_incele: {
    hint: "Fatura geçmişini görüntüle",
    button: { id: "cmd:faturalarim", title: "📄 Faturalar" },
  },
  dealer_kampanya_incele: {
    hint: "Aktif kampanya ve indirimleri gör",
    button: { id: "cmd:aktifkampanyalar", title: "🎯 Kampanyalar" },
  },
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

const COMMAND_MISSION_MAP: Record<string, Record<string, string>> = {
  emlak: {
    // Portföy — mulk_eklendi and mulk_bilgi_updated are CUSTOM EVENTS fired
    // from the success path of the corresponding flow, not on command open.
    // This way "tamamlandı" only means "user actually did the thing", not
    // "user opened the screen".
    mulk_eklendi: "emlak_ilk_mulk",                // fired by finalizeProperty / processPortalUrl
    mulk_bilgi_updated: "emlak_mulk_bilgi_tamamla", // fired by handleMulkDuzenleStep after successful field update
    // fotograf is still mapped because photo upload happens in the web panel,
    // not over WhatsApp — opening the command is the best signal we have.
    // fotograf removed — mission fires from foto_done callback (mulk_foto_uploaded)
    // not from opening the command.
    mulk_foto_uploaded: "emlak_mulk_foto",
    fiyatsor: "emlak_fiyat_kontrol",
    degerle: "emlak_fiyat_kontrol",
    // Müşteri (flow starters — same caveat as fotograf, upgrade to custom
    // events later if accuracy matters)
    musteriEkle: "emlak_ilk_musteri",
    eslestir: "emlak_ilk_eslestirme",
    sunum: "emlak_ilk_sunum",
    takipEt: "emlak_ilk_takip",
    // Analiz — read-only, firing on command open is correct
    analiz: "emlak_ilk_analiz",
    trend: "emlak_ilk_analiz",
    rapor: "emlak_ilk_analiz",
    // Organizasyon — brifing shows content on open, firing OK
    brifing: "emlak_ilk_brifing",
    // Medya
    paylas: "emlak_ilk_paylas",
    yayinla: "emlak_ilk_paylas",
  },
  // TODO: bayi, otel, muhasebe, market mappings
};

// ── Trigger after command execution ─────────────────────────────────

export async function triggerMissionCheck(
  userId: string,
  tenantKey: string,
  commandName: string,
  phone: string,
): Promise<void> {
  try {
    // Update streak — capture current value for scoreboard
    const streak = await updateStreak(userId);

    // Ensure first mission is active (first-time init, role-aware)
    // For bayi this matters because admin & dealer each have a sort_order=1.
    // For other tenants we still scope by user role (defaults to "admin").
    const supabase = getServiceClient();
    const { data: prof0 } = await supabase
      .from("profiles").select("role").eq("id", userId).single();
    const userRole = prof0?.role || "admin";

    const { data: firstMission } = await supabase
      .from("platform_missions")
      .select("id")
      .eq("tenant_key", tenantKey)
      .eq("role", userRole)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    if (firstMission) {
      const { data: existing } = await supabase
        .from("user_mission_progress")
        .select("id")
        .eq("user_id", userId)
        .eq("mission_id", firstMission.id)
        .maybeSingle();
      if (!existing) {
        await supabase.from("user_mission_progress").insert({
          user_id: userId, mission_id: firstMission.id, status: "active",
        });
      }
    }

    // Check mission mapping (reuse userRole from above)
    let missionKey: string | undefined;

    if (tenantKey === "bayi") {
      // Bayi has role-specific mappings
      const bayiMap = await getBayiMap();
      missionKey = bayiMap?.[userRole]?.[commandName];
    } else {
      const tenantMap = COMMAND_MISSION_MAP[tenantKey];
      missionKey = tenantMap?.[commandName];
    }

    if (!missionKey) return;

    // Try to complete mission
    const result = await completeMission(userId, missionKey);

    if (!result.completed) return;

    // ── Scoreboard popup (game-style XP/level-up) ─────────────────
    const sep = "━━━━━━━━━━━━━";
    let msg = `${sep}\n🎮 *İLERLEME*\n`;
    msg += `${result.emoji} ${result.title} ✓\n`;

    // Show XP earned + employee info if available
    const xp = result.xpResult as { xp_added?: number; employee_key?: string; tier_changed?: boolean; new_tier?: number; rank_changed?: boolean; new_rank?: number } | null;
    if (xp?.xp_added && xp.employee_key) {
      const { getEmployee, TIER_NAMES, TIER_STARS } = await import("./employees");
      const emp = getEmployee(tenantKey, xp.employee_key);
      if (emp) {
        msg += `${emp.icon} ${emp.name} +${xp.xp_added} XP\n`;
      }
    }

    msg += `🔥 Seri: ${streak.current} gün`;
    if (streak.current >= 7) msg += " — harika!";
    else if (streak.current === 1) msg += " — yeni başladın!";
    msg += `\n${sep}`;

    // Tier-up celebration (appended before next mission hint)
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

    if (result.nextMission) {
      const cta = MISSION_CTA[result.nextMission];
      if (cta) {
        msg += `\n\n🎯 *Sonraki Görev*\n${cta.hint}`;
        await sendButtons(phone, msg, [cta.button]);
      } else {
        // No mapped CTA — send scoreboard only
        await sendText(phone, msg);
      }
    } else {
      msg += "\n\n🌟 Tüm keşif görevlerini tamamladın! Artık profesyonelsin.";
      await sendText(phone, msg);
    }

    // Check cross-employee combo missions (Junior+ only)
    try {
      const { checkCombos } = await import("./combos");
      const { data: prof2 } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
      if (prof2?.tenant_id) {
        await checkCombos(userId, prof2.tenant_id, tenantKey, missionKey, phone);
      }
    } catch { /* combos are optional */ }
  } catch (err) {
    // Never let gamification break the main flow
    console.error("[gamification:trigger]", err);
  }
}
