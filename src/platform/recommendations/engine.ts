/**
 * Aktif Öneri Motoru — yatay yapı, tüm SaaS'lar aynı engine.
 *
 * Adapter pattern: her tenant kendi `recommendations.ts` dosyasında
 * RULES export eder. Cron tüm tenant'ları dolanır, evaluator çağrısı
 * yapar, recommendation_runs'a kayıt açar (idempotency cooldown_hours).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RecommendationRule {
  code: string;
  title: string;
  bodyTemplate: string;
  actionType: "wa_broadcast" | "navigate" | "create_order" | "mint_coupon" | "upgrade_plan";
  severity: "low" | "normal" | "high";
  cooldownHours: number;
  /** Evaluator: kullanıcı için runs'a girecek payload dizisini döner ([] = öneri yok). */
  evaluate: (
    sb: SupabaseClient,
    ctx: { tenantId: string; userId: string }
  ) => Promise<Array<{
    targetIds?: string[];
    payload: Record<string, unknown>;
    bodyOverride?: string;
    titleOverride?: string;
    score?: number;
  }>>;
}

export interface TenantAdapter {
  tenantKey: string;
  rules: RecommendationRule[];
}

/**
 * Bir kullanıcı için bir kuralı evaluate et + recommendation_runs ekle.
 * Cooldown: aynı user × rule_code son N saatte open varsa skip.
 */
async function runRuleForUser(
  sb: SupabaseClient,
  rule: RecommendationRule,
  ctx: { tenantId: string; userId: string },
): Promise<{ created: number; skipped_cooldown: number }> {
  const cooldownIso = new Date(Date.now() - rule.cooldownHours * 3600 * 1000).toISOString();
  const { data: existing } = await sb
    .from("recommendation_runs")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("rule_code", rule.code)
    .gte("created_at", cooldownIso)
    .limit(1);
  if (existing && existing.length > 0) {
    return { created: 0, skipped_cooldown: 1 };
  }

  let results: Awaited<ReturnType<typeof rule.evaluate>> = [];
  try {
    results = await rule.evaluate(sb, ctx);
  } catch (err) {
    console.error(`[recommendations] ${rule.code} evaluate err`, err);
    return { created: 0, skipped_cooldown: 0 };
  }
  if (!results || results.length === 0) return { created: 0, skipped_cooldown: 0 };

  let created = 0;
  for (const r of results) {
    const now = new Date();
    const expires = new Date(now.getTime() + rule.cooldownHours * 3600 * 1000);
    const title = r.titleOverride || rule.title;
    let body = r.bodyOverride || rule.bodyTemplate;
    for (const [k, v] of Object.entries(r.payload)) {
      body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v));
    }
    const { error } = await sb.from("recommendation_runs").insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      rule_code: rule.code,
      title,
      body,
      action_type: rule.actionType,
      action_payload: r.payload,
      target_ids: r.targetIds || null,
      severity: rule.severity,
      score: r.score ?? (rule.severity === "high" ? 90 : rule.severity === "normal" ? 60 : 30),
      expires_at: expires.toISOString(),
    });
    if (!error) created++;
  }
  return { created, skipped_cooldown: 0 };
}

/**
 * Bir adapter (tenant kuralları) için tüm admin user'lar üzerinden çalıştır.
 */
export async function runAdapterForTenant(
  sb: SupabaseClient,
  adapter: TenantAdapter,
  tenantId: string,
): Promise<{ created: number; skipped: number }> {
  // Hedef kullanıcılar: tenant admin + user role
  const { data: users } = await sb
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "user"]);
  const userIds = (users || []).map(u => u.id);
  if (userIds.length === 0) return { created: 0, skipped: 0 };

  let created = 0, skipped = 0;
  for (const userId of userIds) {
    for (const rule of adapter.rules) {
      const r = await runRuleForUser(sb, rule, { tenantId, userId });
      created += r.created;
      skipped += r.skipped_cooldown;
    }
  }
  return { created, skipped };
}
