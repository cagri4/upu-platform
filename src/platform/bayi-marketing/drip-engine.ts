/**
 * Drip campaign rule-engine — Faz C 3.6.
 *
 * Audience segment formats (JSONB):
 *   { kind: "all" }
 *   { kind: "inactive_days", days: 30 }
 *   { kind: "score_below", value: 50 }
 *   { kind: "overdue" }
 *   { kind: "new_dealer_days", days: 7 }
 *
 * Cron tarafı (her saat):
 *   1. processDueSends — next_send_at <= now olanları gönder + step ilerlet
 *   2. autoEnroll — enrollment_mode='auto' aktif kampanyalar için segment refresh
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "@/platform/notifications/send-notification";

type AudienceKind = "all" | "inactive_days" | "score_below" | "overdue" | "new_dealer_days";

interface Audience {
  kind: AudienceKind;
  days?: number;
  value?: number;
}

interface DripStep {
  id: string;
  campaign_id: string;
  step_order: number;
  delay_days: number;
  channel: string;
  subject: string | null;
  body: string;
  send_condition: Record<string, unknown> | null;
  is_active: boolean;
}

interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  audience: Audience;
  channel: string;
  is_active: boolean;
  enrollment_mode: string;
}

interface Enrollment {
  id: string;
  campaign_id: string;
  tenant_id: string;
  dealer_user_id: string;
  current_step: number;
  status: string;
  next_send_at: string | null;
}

interface DripStats {
  campaigns_evaluated: number;
  sends_attempted: number;
  sends_ok: number;
  sends_failed: number;
  completed: number;
}

export async function getSegmentDealers(
  sb: SupabaseClient,
  tenantId: string,
  audience: Audience,
): Promise<string[]> {
  if (audience.kind === "all") {
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("tenant_key", "bayi")
      .neq("role", "admin")
      .limit(2000);
    return (data || []).map(d => d.id);
  }

  if (audience.kind === "inactive_days") {
    const days = Math.max(1, audience.days || 30);
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
    const { data: recent } = await sb
      .from("bayi_dealer_orders")
      .select("dealer_user_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", sinceIso)
      .limit(5000);
    const activeSet = new Set((recent || []).map(r => r.dealer_user_id));
    const { data: all } = await sb
      .from("profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("tenant_key", "bayi")
      .neq("role", "admin")
      .limit(2000);
    return (all || []).map(d => d.id).filter(id => !activeSet.has(id));
  }

  if (audience.kind === "score_below") {
    const threshold = Math.max(0, audience.value || 50);
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data } = await sb
      .from("bayi_dealer_scores")
      .select("dealer_id, total_score, period_start")
      .eq("tenant_id", tenantId)
      .lt("total_score", threshold)
      .gte("period_start", since)
      .limit(2000);
    return Array.from(new Set((data || []).map(r => r.dealer_id)));
  }

  if (audience.kind === "overdue") {
    const todayIso = new Date().toISOString().slice(0, 10);
    const { data } = await sb
      .from("bayi_invoices")
      .select("dealer_user_id")
      .eq("tenant_id", tenantId)
      .eq("status", "open")
      .lt("due_date", todayIso)
      .limit(2000);
    return Array.from(new Set((data || []).map(r => r.dealer_user_id)));
  }

  if (audience.kind === "new_dealer_days") {
    const days = Math.max(1, audience.days || 7);
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await sb
      .from("profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("tenant_key", "bayi")
      .gte("created_at", sinceIso)
      .neq("role", "admin")
      .limit(2000);
    return (data || []).map(d => d.id);
  }

  return [];
}

export function renderTemplate(body: string, vars: Record<string, string | number | undefined>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v != null ? String(v) : `{{${key}}}`;
  });
}

async function sendOne(
  sb: SupabaseClient,
  enrollment: Enrollment,
  step: DripStep,
  campaign: Campaign,
): Promise<boolean> {
  // Variable substitution (basit — dealer adından alır)
  const { data: dealer } = await sb
    .from("profiles")
    .select("display_name")
    .eq("id", enrollment.dealer_user_id)
    .single();
  const dealerName = dealer?.display_name || "Bayi";

  const body = renderTemplate(step.body, {
    dealer_name: dealerName,
    campaign_name: campaign.name,
  });

  const subject = step.subject
    ? renderTemplate(step.subject, { dealer_name: dealerName, campaign_name: campaign.name })
    : campaign.name;

  try {
    const result = await sendNotification({
      userId: enrollment.dealer_user_id,
      type: "bayi_kampanya_mesaji",
      title: subject.slice(0, 120),
      body: body.slice(0, 1500),
      payload: {
        click_target: "/tr/bayi-panel",
        related_entity_id: campaign.id,
        related_entity_type: "drip_campaign",
        step_order: step.step_order,
      },
    });

    const sendStatus = result.skipped ? "skipped" : "sent";
    await sb.from("bayi_drip_sends").insert({
      enrollment_id: enrollment.id,
      step_id: step.id,
      channel: step.channel,
      status: sendStatus,
      payload: { skipped: result.skipped || null, notif_id: result.notification_id },
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sb.from("bayi_drip_sends").insert({
      enrollment_id: enrollment.id,
      step_id: step.id,
      channel: step.channel,
      status: "failed",
      error_message: message.slice(0, 500),
    });
    return false;
  }
}

export async function processDueSends(sb: SupabaseClient): Promise<DripStats> {
  const stats: DripStats = {
    campaigns_evaluated: 0,
    sends_attempted: 0,
    sends_ok: 0,
    sends_failed: 0,
    completed: 0,
  };

  const nowIso = new Date().toISOString();
  const { data: due } = await sb
    .from("bayi_drip_enrollments")
    .select("id, campaign_id, tenant_id, dealer_user_id, current_step, status, next_send_at")
    .eq("status", "active")
    .lte("next_send_at", nowIso)
    .limit(500);

  for (const enrol of (due || []) as Enrollment[]) {
    const { data: campaign } = await sb
      .from("bayi_drip_campaigns")
      .select("id, tenant_id, name, audience, channel, is_active, enrollment_mode")
      .eq("id", enrol.campaign_id)
      .single();
    if (!campaign || !campaign.is_active) {
      await sb.from("bayi_drip_enrollments").update({ status: "paused" }).eq("id", enrol.id);
      continue;
    }

    const nextStepOrder = enrol.current_step + 1;
    const { data: step } = await sb
      .from("bayi_drip_steps")
      .select("id, campaign_id, step_order, delay_days, channel, subject, body, send_condition, is_active")
      .eq("campaign_id", enrol.campaign_id)
      .eq("step_order", nextStepOrder)
      .eq("is_active", true)
      .maybeSingle();

    if (!step) {
      await sb
        .from("bayi_drip_enrollments")
        .update({ status: "completed", completed_at: nowIso, next_send_at: null })
        .eq("id", enrol.id);
      stats.completed++;
      continue;
    }

    stats.sends_attempted++;
    const ok = await sendOne(sb, enrol, step as DripStep, campaign as Campaign);
    if (ok) stats.sends_ok++; else stats.sends_failed++;

    // Next step delay
    const { data: nextStep } = await sb
      .from("bayi_drip_steps")
      .select("delay_days")
      .eq("campaign_id", enrol.campaign_id)
      .eq("step_order", nextStepOrder + 1)
      .eq("is_active", true)
      .maybeSingle();

    if (nextStep) {
      const nextAt = new Date(Date.now() + Math.max(0, nextStep.delay_days) * 86400000).toISOString();
      await sb
        .from("bayi_drip_enrollments")
        .update({ current_step: nextStepOrder, next_send_at: nextAt })
        .eq("id", enrol.id);
    } else {
      await sb
        .from("bayi_drip_enrollments")
        .update({ current_step: nextStepOrder, status: "completed", completed_at: new Date().toISOString(), next_send_at: null })
        .eq("id", enrol.id);
      stats.completed++;
    }
  }

  return stats;
}

export async function autoEnrollActiveCampaigns(sb: SupabaseClient): Promise<number> {
  let enrolled = 0;
  const { data: campaigns } = await sb
    .from("bayi_drip_campaigns")
    .select("id, tenant_id, name, audience, channel, is_active, enrollment_mode")
    .eq("is_active", true)
    .eq("enrollment_mode", "auto")
    .limit(100);

  for (const camp of (campaigns || []) as Campaign[]) {
    const dealers = await getSegmentDealers(sb, camp.tenant_id, camp.audience);
    if (dealers.length === 0) continue;

    // Find first step delay
    const { data: firstStep } = await sb
      .from("bayi_drip_steps")
      .select("delay_days")
      .eq("campaign_id", camp.id)
      .eq("step_order", 1)
      .eq("is_active", true)
      .maybeSingle();
    if (!firstStep) continue;

    // Already-enrolled set
    const { data: existing } = await sb
      .from("bayi_drip_enrollments")
      .select("dealer_user_id")
      .eq("campaign_id", camp.id);
    const existingSet = new Set((existing || []).map(e => e.dealer_user_id));

    const toEnroll = dealers
      .filter(d => !existingSet.has(d))
      .map(d => ({
        campaign_id: camp.id,
        tenant_id: camp.tenant_id,
        dealer_user_id: d,
        current_step: 0,
        status: "active",
        next_send_at: new Date(Date.now() + Math.max(0, firstStep.delay_days) * 86400000).toISOString(),
      }));
    if (toEnroll.length === 0) continue;

    // Chunked insert
    for (let i = 0; i < toEnroll.length; i += 200) {
      const chunk = toEnroll.slice(i, i + 200);
      await sb.from("bayi_drip_enrollments").insert(chunk).select("id");
    }
    enrolled += toEnroll.length;
  }

  return enrolled;
}
