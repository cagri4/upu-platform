/**
 * Cross-Employee Combo Missions
 *
 * Combos require two actions from different employees within the same
 * session/day. When both parts are done, bonus XP is awarded to both
 * employees. Combos are available from Junior tier onwards.
 *
 * Combos are checked lazily: after any mission/task completion, we
 * scan whether the complementary action was also done today.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { addXp } from "./progression";
import { sendText } from "@/platform/whatsapp/send";
import { getEmployee } from "./employees";

// ── Combo definitions ───────────────────────────────────────────────

export interface ComboDefinition {
  key: string;
  name: string;
  description: string;
  employee_a: string;          // first employee key
  employee_b: string;          // second employee key
  action_a: string;            // mission_key or task_type for employee A
  action_b: string;            // mission_key or task_type for employee B
  bonus_xp: number;            // bonus per employee on completion
  min_tier: number;            // minimum tier of BOTH employees to unlock
}

export const EMLAK_COMBOS: ComboDefinition[] = [
  {
    key: "data_driven_social",
    name: "📊📱 Data-Driven Social",
    description: "Pazar analizi yap, sonra sosyal medyada paylaş",
    employee_a: "analist",
    employee_b: "medya",
    action_a: "emlak_ilk_analiz",  // or analiz task
    action_b: "emlak_ilk_paylas",  // or paylas task
    bonus_xp: 20,
    min_tier: 2, // Junior+
  },
  {
    key: "profesyonel_sunum",
    name: "🏠🤝 Profesyonel Sunum",
    description: "Mülk bilgilerini tamamla, sonra müşteriye sunum gönder",
    employee_a: "portfoy",
    employee_b: "satis",
    action_a: "emlak_mulk_bilgi_tamamla",
    action_b: "emlak_ilk_sunum",
    bonus_xp: 15,
    min_tier: 2,
  },
  {
    key: "koordine_takip",
    name: "🤝📋 Koordine Takip",
    description: "Müşteriye sunum gönder, sonra brifing ile takip planla",
    employee_a: "satis",
    employee_b: "sekreter",
    action_a: "emlak_ilk_sunum",
    action_b: "emlak_ilk_brifing",
    bonus_xp: 15,
    min_tier: 2,
  },
];

// ── Check & award combos ────────────────────────────────────────────

/**
 * Called after a mission or task completion. Checks if any combo's
 * complementary action was also completed today, and if so, awards
 * bonus XP to both employees.
 */
export async function checkCombos(
  userId: string,
  tenantId: string,
  tenantKey: string,
  completedAction: string,
  phone: string,
): Promise<void> {
  if (tenantKey !== "emlak") return; // Only emlak combos for now

  const supabase = getServiceClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const combo of EMLAK_COMBOS) {
    // Does this completion match either side of the combo?
    let matchedSide: "a" | "b" | null = null;
    if (completedAction === combo.action_a) matchedSide = "a";
    else if (completedAction === combo.action_b) matchedSide = "b";
    if (!matchedSide) continue;

    // Check tier requirement
    const { data: progressA } = await supabase
      .from("user_employee_progress")
      .select("tier")
      .eq("user_id", userId)
      .eq("employee_key", combo.employee_a)
      .maybeSingle();

    const { data: progressB } = await supabase
      .from("user_employee_progress")
      .select("tier")
      .eq("user_id", userId)
      .eq("employee_key", combo.employee_b)
      .maybeSingle();

    if ((progressA?.tier || 1) < combo.min_tier || (progressB?.tier || 1) < combo.min_tier) continue;

    // Check if the OTHER side was completed today
    const otherAction = matchedSide === "a" ? combo.action_b : combo.action_a;

    // Check in completed missions
    const { data: missionMatch } = await supabase
      .from("user_mission_progress")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", todayStart.toISOString());

    // Also check xp_events for today (more reliable since it logs all completions)
    const { data: xpMatch } = await supabase
      .from("xp_events")
      .select("id")
      .eq("user_id", userId)
      .eq("source_ref", otherAction)
      .gte("created_at", todayStart.toISOString())
      .limit(1)
      .maybeSingle();

    if (!xpMatch) continue;

    // Check if combo already awarded today
    const { data: alreadyAwarded } = await supabase
      .from("xp_events")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "combo")
      .eq("source_ref", combo.key)
      .gte("created_at", todayStart.toISOString())
      .limit(1)
      .maybeSingle();

    if (alreadyAwarded) continue;

    // Award bonus XP to both employees
    await addXp(userId, tenantId, tenantKey, combo.employee_a, combo.bonus_xp, "combo", combo.key);
    await addXp(userId, tenantId, tenantKey, combo.employee_b, combo.bonus_xp, "combo", combo.key);

    // Notify user
    const empA = getEmployee(tenantKey, combo.employee_a);
    const empB = getEmployee(tenantKey, combo.employee_b);
    const msg = `🎯 *KOMBO!* ${combo.name}\n\n${combo.description}\n\n${empA?.icon || "⭐"} ${empA?.name || combo.employee_a} +${combo.bonus_xp} XP\n${empB?.icon || "⭐"} ${empB?.name || combo.employee_b} +${combo.bonus_xp} XP`;

    try {
      await sendText(phone, msg);
    } catch { /* don't break */ }

    break; // Only award one combo per action
  }
}
