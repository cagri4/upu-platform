/**
 * Cron: Inactivity Check — Proactive Re-engagement
 *
 * Fires every 15 minutes, driven by a Supabase pg_cron job (not Vercel cron).
 * Vercel Hobby plan rejects sub-daily schedules, so the tick comes from
 * Supabase and hits this endpoint over HTTP via pg_net. Schedule lives in
 * supabase/migrations/20260409130000_enable_cron_inactivity.sql.
 *
 * Finds users who were recently active but have stopped responding and
 * nudges them about their currently active mission.
 *
 * This is the "Quest Director push" piece of the gamification engine —
 * the thing that makes the system feel like a coach instead of a dashboard.
 *
 * Guards:
 *   - Quiet hours: 22:00–08:00 TR (19:00–05:00 UTC) — no nudges
 *   - Cooldown:    2 hours between nudges for the same user
 *   - Silence:     user must have been silent for ≥30 minutes
 *   - Window:      user must have been active within the last 3 hours
 *   - Opt-out:     profile.metadata.briefing_enabled === false skips user
 *   - Active mission required: no mission, no nudge
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { MISSION_CTA } from "@/platform/gamification/triggers";

export const dynamic = "force-dynamic";

// ── Tuning ──────────────────────────────────────────────────────────

const SILENCE_MINUTES = 30;      // Must have been silent for at least this long
const ACTIVE_WINDOW_HOURS = 3;   // Must have been active within this window
const COOLDOWN_HOURS = 2;        // Min time between nudges for same user
const QUIET_START_UTC = 19;      // 22:00 TR
const QUIET_END_UTC = 5;         // 08:00 TR

// ── Main handler ────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const supabase = getServiceClient();
    const now = new Date();
    const utcHour = now.getUTCHours();

    // Quiet hours guard
    if (utcHour >= QUIET_START_UTC || utcHour < QUIET_END_UTC) {
      return NextResponse.json({ skipped: true, reason: "quiet_hours", utcHour });
    }

    const nowMs = now.getTime();
    const activeWindowIso = new Date(nowMs - ACTIVE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const silenceThresholdIso = new Date(nowMs - SILENCE_MINUTES * 60 * 1000).toISOString();
    const cooldownIso = new Date(nowMs - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();

    // Step 1: Find users who had any command activity in the last 3 hours
    const { data: recentEvents } = await supabase
      .from("platform_events")
      .select("user_id")
      .eq("event_type", "command")
      .gte("created_at", activeWindowIso)
      .not("user_id", "is", null);

    const candidateIds = [...new Set((recentEvents || []).map(e => e.user_id as string))];
    if (candidateIds.length === 0) {
      return NextResponse.json({ sent: 0, candidates: 0 });
    }

    let sent = 0;
    const skipped: Record<string, number> = {};
    const inc = (reason: string) => { skipped[reason] = (skipped[reason] || 0) + 1; };

    for (const userId of candidateIds) {
      // Step 2: Get this user's most recent command event
      const { data: latest } = await supabase
        .from("platform_events")
        .select("created_at")
        .eq("user_id", userId)
        .eq("event_type", "command")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest?.created_at) { inc("no_latest"); continue; }

      // Must have been silent for at least SILENCE_MINUTES
      if (latest.created_at > silenceThresholdIso) { inc("not_silent_yet"); continue; }

      // Step 3: Cooldown — did we nudge this user in the last COOLDOWN_HOURS?
      const { data: recentNudge } = await supabase
        .from("platform_events")
        .select("id")
        .eq("user_id", userId)
        .eq("event_name", "inactivity_nudge_sent")
        .gte("created_at", cooldownIso)
        .limit(1)
        .maybeSingle();

      if (recentNudge) { inc("cooldown"); continue; }

      // Step 4: Load profile + tenant
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, whatsapp_phone, tenant_id, metadata")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.whatsapp_phone || !profile.tenant_id) { inc("no_profile"); continue; }

      // Opt-out: respect briefing_enabled
      const meta = (profile.metadata || {}) as Record<string, unknown>;
      if (meta.briefing_enabled === false) { inc("opted_out"); continue; }

      const { data: tenant } = await supabase
        .from("tenants")
        .select("saas_type")
        .eq("id", profile.tenant_id)
        .maybeSingle();

      const tenantKey = tenant?.saas_type;
      if (!tenantKey) { inc("no_tenant"); continue; }

      // Step 5: Find active mission (lowest sort_order among user's active missions)
      const { data: progresses } = await supabase
        .from("user_mission_progress")
        .select("mission_id")
        .eq("user_id", userId)
        .eq("status", "active");

      if (!progresses || progresses.length === 0) { inc("no_active_mission"); continue; }

      const missionIds = progresses.map(p => p.mission_id);
      const { data: missions } = await supabase
        .from("platform_missions")
        .select("mission_key, title, emoji")
        .in("id", missionIds)
        .eq("tenant_key", tenantKey)
        .order("sort_order")
        .limit(1);

      const mission = missions?.[0];
      if (!mission) { inc("no_mission_row"); continue; }

      // Step 6: Resolve CTA — if we don't have a button mapping, skip
      const cta = MISSION_CTA[mission.mission_key];
      if (!cta) { inc("no_cta_map"); continue; }

      // Step 7: Build nudge message
      const firstName = (profile.display_name || "").split(" ")[0];
      const namePart = firstName ? `${firstName}, ` : "";
      const silentMin = Math.round((nowMs - new Date(latest.created_at).getTime()) / 60000);

      let msg = `👋 ${namePart}yarım bıraktığın bir görevin var:\n\n`;
      msg += `${mission.emoji || "🎯"} *${mission.title}*\n`;
      msg += `_${cta.hint}_\n\n`;
      msg += `Hadi tamamlayalım 👇`;

      try {
        await sendButtons(profile.whatsapp_phone, msg, [
          cta.button,
          { id: "cmd:menu", title: "Ana Menü" },
        ]);

        // Step 8: Log the nudge so cooldown works next cycle
        await supabase.from("platform_events").insert({
          event_type: "system",
          event_name: "inactivity_nudge_sent",
          user_id: userId,
          tenant_id: profile.tenant_id,
          tenant_key: tenantKey,
          metadata: {
            mission_key: mission.mission_key,
            silent_minutes: silentMin,
          },
        });

        sent++;
      } catch (err) {
        console.error(`[inactivity-check] sendButtons failed for ${userId}:`, err);
        inc("send_failed");
      }
    }

    return NextResponse.json({
      sent,
      candidates: candidateIds.length,
      skipped,
    });
  } catch (err) {
    console.error("[inactivity-check]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
