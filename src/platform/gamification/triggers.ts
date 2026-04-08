/**
 * Gamification Triggers — komut tamamlandığında misyon kontrolü
 *
 * Router'dan her komut sonrası çağrılır.
 * İlgili misyonu tamamlar, kullanıcıya tebrik + sonraki görev gösterir.
 */

import { completeMission, updateStreak, getUserMissions } from "./engine";
import { sendText } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── Command → Mission mapping ───────────────────────────────────────

const COMMAND_MISSION_MAP: Record<string, Record<string, string>> = {
  emlak: {
    // Portföy
    mulkekle: "emlak_ilk_mulk",
    tara: "emlak_ilk_mulk",
    ekle: "emlak_ilk_mulk",
    mulkduzenle: "emlak_mulk_bilgi_tamamla",
    fotograf: "emlak_mulk_foto",
    fiyatsor: "emlak_fiyat_kontrol",
    degerle: "emlak_fiyat_kontrol",
    // Müşteri
    musteriEkle: "emlak_ilk_musteri",
    eslestir: "emlak_ilk_eslestirme",
    sunum: "emlak_ilk_sunum",
    takipEt: "emlak_ilk_takip",
    // Analiz
    analiz: "emlak_ilk_analiz",
    trend: "emlak_ilk_analiz",
    rapor: "emlak_ilk_analiz",
    // Organizasyon
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
    // Update streak
    await updateStreak(userId);

    // Ensure first mission is active (first-time init)
    const missions = await getUserMissions(userId, tenantKey);
    const firstMission = missions.find(m => m.sort_order === 1);
    if (firstMission && !firstMission.progress) {
      const supabase = getServiceClient();
      await supabase.from("user_mission_progress").insert({
        user_id: userId, mission_id: firstMission.id, status: "active",
      });
    }

    // Check mission mapping
    const tenantMap = COMMAND_MISSION_MAP[tenantKey];
    if (!tenantMap) return;

    const missionKey = tenantMap[commandName];
    if (!missionKey) return;

    // Try to complete mission
    const result = await completeMission(userId, missionKey);

    if (result.completed) {
      // Send celebration message
      let msg = `\n${result.message}`;

      // If there's a next mission, hint at it
      if (result.nextMission) {
        const nextHints: Record<string, string> = {
          emlak_mulk_bilgi_tamamla: "\n\n💡 Sonraki görev: mülk bilgilerini tamamlayın",
          emlak_mulk_foto: "\n\n💡 Sonraki görev: mülke fotoğraf ekleyin",
          emlak_fiyat_kontrol: "\n\n💡 Sonraki görev: piyasa fiyatını kontrol edin",
          emlak_ilk_musteri: "\n\n💡 Sonraki görev: ilk müşterinizi ekleyin",
          emlak_ilk_eslestirme: "\n\n💡 Sonraki görev: müşteri-mülk eşleştirin",
          emlak_ilk_sunum: "\n\n💡 Sonraki görev: müşteriye sunum gönderin",
          emlak_ilk_takip: "\n\n💡 Sonraki görev: müşterinizi takip edin",
          emlak_ilk_analiz: "\n\n💡 Sonraki görev: pazar analizi yapın",
          emlak_ilk_brifing: "\n\n💡 Sonraki görev: günlük brifinginizi okuyun",
          emlak_ilk_paylas: "\n\n💡 Sonraki görev: mülkünüzü paylaşın",
        };
        msg += nextHints[result.nextMission] || "";
      } else {
        msg += "\n\n🌟 Tüm keşif görevlerini tamamladınız! Artık profesyonelsiniz.";
      }

      await sendText(phone, msg);
    }
  } catch (err) {
    // Never let gamification break the main flow
    console.error("[gamification:trigger]", err);
  }
}
