/**
 * Tip picker — resolves the best tip for a user at a given moment.
 *
 * Rules:
 *   - Tip must be eligible for user's current context
 *   - Same tip not shown in last 14 days
 *   - Among eligible, weighted by priority
 *   - Respects quiet hours + daily cap
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { EMLAK_TIPS, type Tip, type TipContext } from "./library";

export type NotifPrefs = {
  tips_enabled: boolean;
  tips_per_day: number;
  quiet_start_hour: number;
  quiet_end_hour: number;
};

const DEFAULT_PREFS: NotifPrefs = {
  tips_enabled: true,
  tips_per_day: 3,
  quiet_start_hour: 22,
  quiet_end_hour: 9,
};

const COOLDOWN_DAYS = 14;

// ── Context resolution ───────────────────────────────────────────────

export async function resolveUserContext(userId: string): Promise<TipContext> {
  const sb = getServiceClient();
  const now = Date.now();

  const [
    { count: propertyCount },
    { count: customerCount },
    { count: reminderCount },
    { count: contractCount },
    { data: profile },
    { data: botActivity },
  ] = await Promise.all([
    sb.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("reminders").select("*", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("contracts").select("*", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("profiles").select("created_at").eq("id", userId).maybeSingle(),
    sb.from("bot_activity").select("action").eq("user_id", userId).limit(500),
  ]);

  const daysSinceSignup = profile?.created_at
    ? Math.max(0, Math.floor((now - new Date(profile.created_at).getTime()) / (24 * 60 * 60 * 1000)))
    : 0;

  const uniqueCommandsUsed = new Set((botActivity || []).map((a) => a.action).filter(Boolean)).size;

  return {
    propertyCount: propertyCount || 0,
    customerCount: customerCount || 0,
    reminderCount: reminderCount || 0,
    contractCount: contractCount || 0,
    daysSinceSignup,
    uniqueCommandsUsed,
  };
}

// ── Preferences ──────────────────────────────────────────────────────

export async function getPrefs(userId: string): Promise<NotifPrefs> {
  const sb = getServiceClient();
  const { data } = await sb.from("user_notification_prefs").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return DEFAULT_PREFS;
  return {
    tips_enabled: data.tips_enabled ?? true,
    tips_per_day: data.tips_per_day ?? 3,
    quiet_start_hour: data.quiet_start_hour ?? 22,
    quiet_end_hour: data.quiet_end_hour ?? 9,
  };
}

export function isQuietHour(prefs: NotifPrefs, nowHourUtc: number, tzOffsetMinutes = 180): boolean {
  const localHour = (nowHourUtc * 60 + tzOffsetMinutes) / 60 % 24;
  const start = prefs.quiet_start_hour;
  const end = prefs.quiet_end_hour;
  if (start < end) {
    return localHour >= start && localHour < end;
  }
  // wraps midnight (e.g. 22 → 9)
  return localHour >= start || localHour < end;
}

// ── Picker ───────────────────────────────────────────────────────────

/**
 * Resolve the best tip to show a user now. Returns null if:
 *   - tips disabled
 *   - quiet hours
 *   - daily cap reached
 *   - no eligible tips (all in cooldown or context mismatch)
 */
export async function pickTipForUser(
  userId: string,
  tipPool: Tip[] = EMLAK_TIPS,
): Promise<Tip | null> {
  const prefs = await getPrefs(userId);
  if (!prefs.tips_enabled) return null;

  // Daily cap check
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sb = getServiceClient();
  const { count: todayCount } = await sb
    .from("user_tips_shown")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("shown_at", todayStart.toISOString());

  if ((todayCount || 0) >= prefs.tips_per_day) return null;

  // Cooldown keys
  const cooldownSince = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await sb
    .from("user_tips_shown")
    .select("tip_key")
    .eq("user_id", userId)
    .gte("shown_at", cooldownSince);
  const blocked = new Set((recent || []).map((r) => r.tip_key));

  // Resolve context + filter eligible + not in cooldown
  const ctx = await resolveUserContext(userId);
  const eligible = tipPool
    .filter((t) => !blocked.has(t.key))
    .filter((t) => t.eligible(ctx));

  if (eligible.length === 0) return null;

  // Weighted-priority random pick
  const totalWeight = eligible.reduce((sum, t) => sum + t.priority, 0);
  let r = Math.random() * totalWeight;
  for (const t of eligible) {
    r -= t.priority;
    if (r <= 0) return t;
  }
  return eligible[0];
}

// ── Logging ──────────────────────────────────────────────────────────

export async function logTipShown(userId: string, tipKey: string, tenantKey = "emlak"): Promise<void> {
  const sb = getServiceClient();
  await sb.from("user_tips_shown").insert({
    user_id: userId,
    tenant_key: tenantKey,
    tip_key: tipKey,
  });
}

export async function logTipClicked(userId: string, tipKey: string): Promise<void> {
  const sb = getServiceClient();
  // Update most recent shown entry for this tip
  const { data: recent } = await sb
    .from("user_tips_shown")
    .select("id")
    .eq("user_id", userId)
    .eq("tip_key", tipKey)
    .is("clicked_at", null)
    .order("shown_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) {
    await sb.from("user_tips_shown")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", recent.id);
  }
}
