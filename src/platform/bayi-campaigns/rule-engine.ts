/**
 * Otomatik kampanya tetik motoru.
 *
 * Event türleri (3.4 MVP):
 *   - orderless_n_days  : bayi N gündür sipariş atmadı
 *   - overdue_days      : bayi vade gecikmesi N gün
 *   - score_below       : bayi performans skoru N altında
 *
 * Action türleri (MVP):
 *   - wa_message  : sendNotification freeform (24h customer service window)
 *   - admin_alert : sadece admin'e push (notification)
 *
 * Idempotency: bayi_campaign_executions cooldown_days kontrolü — aynı
 * bayi × rule için cooldown içinde tekrar yok.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "@/platform/notifications/send-notification";

export interface CampaignTrigger {
  id: string;
  tenant_id: string;
  name: string;
  event_type: string;
  conditions: Record<string, unknown>;
  action_type: string;
  action_payload: Record<string, unknown>;
  cooldown_days: number;
  is_active: boolean;
  last_run_at: string | null;
}

interface DealerCandidate {
  dealer_id: string;
  dealer_name: string;
  dealer_user_id: string | null;
  signals: Record<string, unknown>;
}

const VALID_EVENT_TYPES = ["orderless_n_days", "overdue_days", "score_below"] as const;
const VALID_ACTION_TYPES = ["wa_message", "admin_alert"] as const;

export type ValidEventType = typeof VALID_EVENT_TYPES[number];
export type ValidActionType = typeof VALID_ACTION_TYPES[number];

export function isValidEventType(t: string): t is ValidEventType {
  return (VALID_EVENT_TYPES as readonly string[]).includes(t);
}
export function isValidActionType(t: string): t is ValidActionType {
  return (VALID_ACTION_TYPES as readonly string[]).includes(t);
}

/**
 * Bir tetikleyici için aday bayileri bul.
 */
async function findCandidates(
  sb: SupabaseClient,
  trigger: CampaignTrigger,
): Promise<DealerCandidate[]> {
  const cond = trigger.conditions || {};

  if (trigger.event_type === "orderless_n_days") {
    const days = Number(cond.days) || 30;
    const { data } = await sb
      .from("bayi_churn_signals")
      .select("dealer_id, dealer_name, company_name, days_since_last_order")
      .eq("tenant_id", trigger.tenant_id)
      .gte("days_since_last_order", days);
    const { data: dealerProfiles } = await sb
      .from("bayi_dealers")
      .select("id, user_id")
      .eq("tenant_id", trigger.tenant_id);
    const userMap = new Map((dealerProfiles || []).map(d => [d.id, d.user_id]));
    return (data || []).map(d => ({
      dealer_id: d.dealer_id,
      dealer_name: d.dealer_name || d.company_name || "Bayi",
      dealer_user_id: userMap.get(d.dealer_id) || null,
      signals: { days_since_last_order: d.days_since_last_order },
    }));
  }

  if (trigger.event_type === "overdue_days") {
    const days = Number(cond.days) || 7;
    const { data } = await sb
      .from("bayi_churn_signals")
      .select("dealer_id, dealer_name, company_name, max_overdue_days")
      .eq("tenant_id", trigger.tenant_id)
      .gte("max_overdue_days", days);
    const { data: dealerProfiles } = await sb
      .from("bayi_dealers")
      .select("id, user_id")
      .eq("tenant_id", trigger.tenant_id);
    const userMap = new Map((dealerProfiles || []).map(d => [d.id, d.user_id]));
    return (data || []).map(d => ({
      dealer_id: d.dealer_id,
      dealer_name: d.dealer_name || d.company_name || "Bayi",
      dealer_user_id: userMap.get(d.dealer_id) || null,
      signals: { max_overdue_days: d.max_overdue_days },
    }));
  }

  if (trigger.event_type === "score_below") {
    const threshold = Number(cond.score) || 50;
    // En son skor per dealer
    const { data: scores } = await sb
      .from("bayi_dealer_scores")
      .select("dealer_id, score_total, period_start")
      .eq("tenant_id", trigger.tenant_id)
      .order("period_start", { ascending: false })
      .limit(2000);
    const latest = new Map<string, { score: number; period: string }>();
    for (const r of scores || []) {
      if (!latest.has(r.dealer_id)) {
        latest.set(r.dealer_id, { score: Number(r.score_total) || 0, period: r.period_start });
      }
    }
    const matches = [...latest.entries()].filter(([, v]) => v.score < threshold);
    if (matches.length === 0) return [];

    const { data: dealers } = await sb
      .from("bayi_dealers")
      .select("id, name, company_name, user_id")
      .eq("tenant_id", trigger.tenant_id)
      .in("id", matches.map(m => m[0]));
    return (dealers || []).map(d => ({
      dealer_id: d.id,
      dealer_name: d.name || d.company_name || "Bayi",
      dealer_user_id: d.user_id || null,
      signals: { score_total: latest.get(d.id)?.score, period_start: latest.get(d.id)?.period },
    }));
  }

  return [];
}

/**
 * Cooldown filtresi — aynı dealer × trigger son N gün içinde çalıştıysa skip.
 */
async function filterCooldown(
  sb: SupabaseClient,
  trigger: CampaignTrigger,
  candidates: DealerCandidate[],
): Promise<DealerCandidate[]> {
  if (candidates.length === 0) return [];
  const cooldownIso = new Date(Date.now() - trigger.cooldown_days * 86400000).toISOString();
  const { data: recent } = await sb
    .from("bayi_campaign_executions")
    .select("dealer_id")
    .eq("trigger_id", trigger.id)
    .gte("executed_at", cooldownIso)
    .eq("status", "sent");
  const recentSet = new Set((recent || []).map(r => r.dealer_id));
  return candidates.filter(c => !recentSet.has(c.dealer_id));
}

/**
 * Action: WA mesajı veya admin alert.
 */
async function runAction(
  sb: SupabaseClient,
  trigger: CampaignTrigger,
  candidate: DealerCandidate,
): Promise<{ status: "sent" | "skipped" | "failed"; error?: string }> {
  const payload = trigger.action_payload || {};

  if (trigger.action_type === "wa_message") {
    if (!candidate.dealer_user_id) {
      return { status: "skipped", error: "dealer_user_id yok" };
    }
    const tmpl = (payload.template as string) || `Merhaba ${candidate.dealer_name}, ${trigger.name} kampanyamız sizin için aktif. Detay için panele bakın.`;
    const body = tmpl.replace(/\{\{dealer_name\}\}/g, candidate.dealer_name);
    try {
      const r = await sendNotification({
        userId: candidate.dealer_user_id,
        type: "campaign_trigger",
        title: trigger.name,
        body,
        payload: { trigger_id: trigger.id, dealer_id: candidate.dealer_id },
      });
      return { status: r.notification_id ? "sent" : "skipped" };
    } catch (err) {
      return { status: "failed", error: (err as Error).message };
    }
  }

  if (trigger.action_type === "admin_alert") {
    // Tenant admin'leri bul
    const { data: admins } = await sb
      .from("profiles")
      .select("id")
      .eq("tenant_id", trigger.tenant_id)
      .in("role", ["admin", "user"]);
    const adminIds = (admins || []).map(a => a.id);
    const body = `${candidate.dealer_name}: ${JSON.stringify(candidate.signals)}`;
    let any = false;
    for (const aid of adminIds) {
      try {
        const r = await sendNotification({
          userId: aid,
          type: "campaign_trigger",
          title: trigger.name,
          body,
          payload: { trigger_id: trigger.id, dealer_id: candidate.dealer_id },
        });
        if (r.notification_id) any = true;
      } catch { /* ignore */ }
    }
    return { status: any ? "sent" : "skipped" };
  }

  return { status: "failed", error: `Bilinmeyen action_type: ${trigger.action_type}` };
}

/**
 * Tek tetikleyiciyi evaluate et + action'ları çalıştır.
 */
export async function runTrigger(
  sb: SupabaseClient,
  trigger: CampaignTrigger,
): Promise<{ matched: number; sent: number; skipped: number; failed: number }> {
  const candidates = await findCandidates(sb, trigger);
  const filtered = await filterCooldown(sb, trigger, candidates);
  let sent = 0, skipped = 0, failed = 0;

  for (const c of filtered) {
    const r = await runAction(sb, trigger, c);
    await sb.from("bayi_campaign_executions").insert({
      trigger_id: trigger.id,
      tenant_id: trigger.tenant_id,
      dealer_id: c.dealer_id,
      target_user_id: c.dealer_user_id,
      status: r.status,
      payload_snapshot: { signals: c.signals, action_payload: trigger.action_payload },
      error: r.error || null,
    });
    if (r.status === "sent") sent++;
    else if (r.status === "skipped") skipped++;
    else failed++;
  }

  await sb.from("bayi_campaign_triggers")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", trigger.id);

  return { matched: candidates.length, sent, skipped, failed };
}
