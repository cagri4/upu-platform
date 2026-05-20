/**
 * UPU Agent quota helpers — aylık mesaj limiti, kullanım tracking, detay log.
 *
 * agent_quotas: PRIMARY KEY (user_id, period_start) — bir kullanıcı için bir
 * periyot bir satır. Aktif satır period_end > today olan.
 *
 * Plan tier'ları (agent_plans tablosunda): free 50 / starter 300 / pro 1500 /
 * premium 5000. Yeni kullanıcı default 'free'. period_end = period_start + 30d.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type QuotaStatus = "ok" | "warning" | "critical" | "exceeded";

export interface QuotaRow {
  user_id: string;
  tenant_id: string;
  plan_key: string;
  period_start: string;
  period_end: string;
  used_messages: number;
  used_input_tokens: number;
  used_output_tokens: number;
  cache_read_tokens: number;
  estimated_cost_usd: number;
  last_message_at: string | null;
}

export interface QuotaState {
  row: QuotaRow;
  limit: number;
  remaining: number;
  percent: number;
  status: QuotaStatus;
  plan_display: string;
  days_until_reset: number;
}

function statusFor(percent: number): QuotaStatus {
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "critical";
  if (percent >= 70) return "warning";
  return "ok";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.max(0, Math.ceil((to - from) / 86400000));
}

/**
 * Aktif quota satırı + plan limit bilgisi. Yoksa default 'free' planla yarat.
 */
export async function getOrCreateQuota(
  sb: SupabaseClient,
  userId: string,
  tenantId: string,
): Promise<QuotaState> {
  const today = todayIso();

  // Aktif satır: period_end >= today, son giren
  const { data: active } = await sb
    .from("agent_quotas")
    .select("*")
    .eq("user_id", userId)
    .gte("period_end", today)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  let row: QuotaRow;
  if (active) {
    row = active as QuotaRow;
  } else {
    // Yeni kullanıcı veya eski periyot bitmiş — free plan satırı aç
    const periodStart = today;
    const periodEnd = addDays(periodStart, 30);
    const { data: inserted, error } = await sb
      .from("agent_quotas")
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        plan_key: "free",
        period_start: periodStart,
        period_end: periodEnd,
      })
      .select("*")
      .single();
    if (error || !inserted) {
      throw new Error(`Quota init failed: ${error?.message || "unknown"}`);
    }
    row = inserted as QuotaRow;
  }

  // Plan limit lookup
  const { data: plan } = await sb
    .from("agent_plans")
    .select("display_name, monthly_message_limit")
    .eq("key", row.plan_key)
    .maybeSingle();

  const limit = (plan?.monthly_message_limit as number) || 50;
  const planDisplay = (plan?.display_name as string) || "Deneme";
  const remaining = Math.max(0, limit - row.used_messages);
  const percent = limit > 0 ? Math.min(999, Math.round((row.used_messages / limit) * 100)) : 0;

  return {
    row,
    limit,
    remaining,
    percent,
    status: statusFor(percent),
    plan_display: planDisplay,
    days_until_reset: daysBetween(today, row.period_end),
  };
}

/**
 * Bir mesajlık kullanım kaydı. messages +1, token toplamları cumulative.
 */
export async function incrementQuota(
  sb: SupabaseClient,
  userId: string,
  periodStart: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cost_usd: number;
  },
): Promise<void> {
  // Atomik artırım için RPC olmadığından two-step: önce mevcut sayıları çek,
  // sonra yeni toplamla update. Race condition'da son yazan kazanır — tek
  // kullanıcı için aynı saniyede 2 mesaj atması nadir, kabul edilebilir.
  const { data: cur } = await sb
    .from("agent_quotas")
    .select("used_messages, used_input_tokens, used_output_tokens, cache_read_tokens, estimated_cost_usd")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (!cur) return;

  await sb
    .from("agent_quotas")
    .update({
      used_messages: (cur.used_messages as number) + 1,
      used_input_tokens: (cur.used_input_tokens as number) + usage.input_tokens,
      used_output_tokens: (cur.used_output_tokens as number) + usage.output_tokens,
      cache_read_tokens: (cur.cache_read_tokens as number) + usage.cache_read,
      estimated_cost_usd: Number(cur.estimated_cost_usd) + usage.cost_usd,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("period_start", periodStart);
}

/**
 * Power user transparency için detay event log (her chat çağrısında 1 satır).
 */
export async function logUsageEvent(
  sb: SupabaseClient,
  userId: string,
  tenantId: string,
  conversationId: string | null,
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read: number;
    cache_write: number;
    cost_usd: number;
    tool_calls: string[];
  },
): Promise<void> {
  await sb.from("agent_usage_events").insert({
    user_id: userId,
    tenant_id: tenantId,
    conversation_id: conversationId,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: usage.cache_read,
    cache_write_tokens: usage.cache_write,
    tool_calls: usage.tool_calls,
    model,
    cost_usd: usage.cost_usd,
  });
}
