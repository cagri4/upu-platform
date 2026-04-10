/**
 * Progression Engine — XP, tier computation, rank calculation.
 *
 * Core functions:
 *   addXp()               — award XP to an employee, check tier-up
 *   getUserEmployeeState() — full state of all employees for a user
 *   getUserRank()          — computed meta-rank from employee tiers
 *   getActiveSeason()      — current seasonal event (if any)
 */

import { getServiceClient } from "@/platform/auth/supabase";
import {
  TIER_THRESHOLDS,
  TIER_NAMES,
  TIER_STARS,
  MAX_TIER,
  USER_RANK_THRESHOLDS,
  USER_RANK_NAMES,
  DAILY_XP_CAP,
  getEmployees,
  getEmployee,
} from "./employees";
import type { EmployeeDefinition } from "./employees";

// ── Types ───────────────────────────────────────────────────────────

export interface EmployeeState {
  employee_key: string;
  name: string;
  icon: string;
  tier: number;
  tier_name: string;
  stars: string;
  xp: number;
  xp_next: number;        // XP needed for next tier
  xp_progress: number;    // 0-100 percentage
  total_xp_earned: number;
}

export interface UserProgressState {
  employees: EmployeeState[];
  rank: number;
  rank_name: string;
  total_xp: number;
  tier_sum: number;
}

export interface SeasonalEvent {
  key: string;
  title: string;
  description: string;
  bonus_xp_multiplier: number;
  employee_focus: string[];
}

export interface AddXpResult {
  xp_added: number;
  employee_key: string;
  new_xp: number;
  new_tier: number;
  tier_changed: boolean;
  old_tier: number;
  rank_changed: boolean;
  old_rank: number;
  new_rank: number;
  capped: boolean;    // true if daily cap hit
}

// ── Tier computation ────────────────────────────────────────────────

function computeTier(xp: number): number {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= TIER_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function computeRank(tierSum: number): number {
  for (let i = USER_RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (tierSum >= USER_RANK_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

// ── Add XP ──────────────────────────────────────────────────────────

export async function addXp(
  userId: string,
  tenantId: string,
  tenantKey: string,
  employeeKey: string,
  amount: number,
  source: string,
  sourceRef?: string,
): Promise<AddXpResult> {
  const supabase = getServiceClient();

  // Check daily cap
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todayEvents } = await supabase
    .from("xp_events")
    .select("amount")
    .eq("user_id", userId)
    .gte("created_at", todayStart.toISOString());

  const todayTotal = (todayEvents || []).reduce((sum, e) => sum + e.amount, 0);
  const remaining = Math.max(0, DAILY_XP_CAP - todayTotal);
  const effectiveAmount = Math.min(amount, remaining);
  const capped = effectiveAmount < amount;

  if (effectiveAmount <= 0) {
    // Daily cap reached — return zero result
    const state = await getEmployeeProgress(supabase, userId, employeeKey);
    const allStates = await getAllEmployeeProgress(supabase, userId);
    const tierSum = allStates.reduce((sum, s) => sum + s.tier, 0);
    const rank = computeRank(tierSum);
    return {
      xp_added: 0, employee_key: employeeKey,
      new_xp: state.xp, new_tier: state.tier, tier_changed: false,
      old_tier: state.tier, rank_changed: false, old_rank: rank, new_rank: rank, capped: true,
    };
  }

  // Check seasonal bonus
  const season = await getActiveSeason(tenantKey);
  let finalAmount = effectiveAmount;
  if (season && season.employee_focus.includes(employeeKey)) {
    finalAmount = Math.round(effectiveAmount * season.bonus_xp_multiplier);
  }

  // Get or create employee progress row
  let state = await getEmployeeProgress(supabase, userId, employeeKey);
  const oldTier = state.tier;

  if (!state.id) {
    // First time — insert
    const { data: inserted } = await supabase
      .from("user_employee_progress")
      .insert({
        user_id: userId, tenant_id: tenantId,
        employee_key: employeeKey, tier: 1, xp: finalAmount,
        total_xp_earned: finalAmount,
      })
      .select("id, xp, tier, total_xp_earned")
      .single();
    state = inserted || { id: null, xp: finalAmount, tier: 1, total_xp_earned: finalAmount };
  } else {
    // Update existing
    const newXp = state.xp + finalAmount;
    const newTotalXp = state.total_xp_earned + finalAmount;
    const newTier = computeTier(newXp);
    await supabase
      .from("user_employee_progress")
      .update({ xp: newXp, tier: newTier, total_xp_earned: newTotalXp, updated_at: new Date().toISOString() })
      .eq("id", state.id);
    state = { ...state, xp: newXp, tier: newTier, total_xp_earned: newTotalXp };
  }

  // Log XP event
  await supabase.from("xp_events").insert({
    user_id: userId, employee_key: employeeKey,
    amount: finalAmount, source, source_ref: sourceRef || null,
  });

  // Check rank change
  const allStates = await getAllEmployeeProgress(supabase, userId);
  const tierSum = allStates.reduce((sum, s) => sum + s.tier, 0);
  const newRank = computeRank(tierSum);
  const oldRank = computeRank(tierSum - (state.tier - oldTier)); // approximate old rank

  return {
    xp_added: finalAmount,
    employee_key: employeeKey,
    new_xp: state.xp,
    new_tier: state.tier,
    tier_changed: state.tier > oldTier,
    old_tier: oldTier,
    rank_changed: newRank > oldRank,
    old_rank: oldRank,
    new_rank: newRank,
    capped,
  };
}

// ── Query helpers ───────────────────────────────────────────────────

async function getEmployeeProgress(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  employeeKey: string,
): Promise<{ id: string | null; xp: number; tier: number; total_xp_earned: number }> {
  const { data } = await supabase
    .from("user_employee_progress")
    .select("id, xp, tier, total_xp_earned")
    .eq("user_id", userId)
    .eq("employee_key", employeeKey)
    .maybeSingle();
  return data || { id: null, xp: 0, tier: 1, total_xp_earned: 0 };
}

async function getAllEmployeeProgress(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<Array<{ employee_key: string; xp: number; tier: number; total_xp_earned: number }>> {
  const { data } = await supabase
    .from("user_employee_progress")
    .select("employee_key, xp, tier, total_xp_earned")
    .eq("user_id", userId);
  return data || [];
}

// ── Full user state ─────────────────────────────────────────────────

export async function getUserEmployeeState(userId: string, tenantKey: string): Promise<UserProgressState> {
  const supabase = getServiceClient();
  const employees = getEmployees(tenantKey);
  const progress = await getAllEmployeeProgress(supabase, userId);
  const progressMap: Record<string, { xp: number; tier: number; total_xp_earned: number }> = {};
  for (const p of progress) progressMap[p.employee_key] = p;

  const states: EmployeeState[] = employees.map(emp => {
    const p = progressMap[emp.key] || { xp: 0, tier: 1, total_xp_earned: 0 };
    const tier = computeTier(p.xp);
    const nextThreshold = tier < MAX_TIER ? TIER_THRESHOLDS[tier] : TIER_THRESHOLDS[MAX_TIER - 1];
    const currentThreshold = TIER_THRESHOLDS[tier - 1];
    const xpInTier = p.xp - currentThreshold;
    const xpNeeded = nextThreshold - currentThreshold;
    const progress = xpNeeded > 0 ? Math.round((xpInTier / xpNeeded) * 100) : 100;

    return {
      employee_key: emp.key,
      name: emp.name,
      icon: emp.icon,
      tier,
      tier_name: TIER_NAMES[tier] || "Stajyer",
      stars: TIER_STARS[tier] || "⭐",
      xp: p.xp,
      xp_next: tier < MAX_TIER ? nextThreshold : p.xp,
      xp_progress: Math.min(progress, 100),
      total_xp_earned: p.total_xp_earned,
    };
  });

  const tierSum = states.reduce((sum, s) => sum + s.tier, 0);
  const rank = computeRank(tierSum);
  const totalXp = states.reduce((sum, s) => sum + s.total_xp_earned, 0);

  return {
    employees: states,
    rank,
    rank_name: USER_RANK_NAMES[rank] || "Stajyer Emlak Danışmanı",
    total_xp: totalXp,
    tier_sum: tierSum,
  };
}

// ── User rank shortcut ──────────────────────────────────────────────

export async function getUserRank(userId: string, tenantKey: string): Promise<{ rank: number; rank_name: string; total_xp: number }> {
  const state = await getUserEmployeeState(userId, tenantKey);
  return { rank: state.rank, rank_name: state.rank_name, total_xp: state.total_xp };
}

// ── Active season ───────────────────────────────────────────────────

export async function getActiveSeason(tenantKey: string): Promise<SeasonalEvent | null> {
  const supabase = getServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("seasonal_events")
    .select("key, title, description, bonus_xp_multiplier, employee_focus")
    .eq("active", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .or(`tenant_key.is.null,tenant_key.eq.${tenantKey}`)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    key: data.key,
    title: data.title,
    description: data.description || "",
    bonus_xp_multiplier: data.bonus_xp_multiplier,
    employee_focus: data.employee_focus || [],
  };
}
