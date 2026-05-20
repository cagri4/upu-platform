/**
 * GET /api/bayi-ayarlar/summary
 *
 * Ayarlar sayfası için tek seferde 4 dataset:
 *   - firma: profile.metadata.firma_profili (ticari unvan, vergi, IBAN…)
 *   - tier: bayi billing tier (starter/growth/pro) + limits + features
 *   - quota: agent_quotas aktif satır (used/limit/period_end)
 *   - tenant_meta: çalışan/bayi sayısı, oluşturma tarihi
 *
 * Admin-only değil — tenant member herkes okuyabilir, ama "düzenle" linki
 * sadece admin'e (UI tarafında banner ile).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { TIER_FEATURES, type BayiTier } from "@/tenants/bayi/billing/tier-features";
import { getOrCreateQuota } from "@/platform/agent/quota";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["admin", "user"]);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null;
    display_name: string | null; metadata: Record<string, unknown> | null;
    invited_by: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, role, display_name, metadata, invited_by",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const me = lookup.profile;
  const tenantId = lookup.tenantId;
  const isAdmin = ADMIN_ROLES.has(me.role || "");

  // Owner profili: invited_by varsa o yönlendirir tier'ı; yoksa kendisi
  const ownerId = me.invited_by || me.id;
  const { data: owner } = await sb
    .from("profiles")
    .select("id, display_name, metadata, created_at")
    .eq("id", ownerId)
    .maybeSingle();
  const ownerMeta = (owner?.metadata || {}) as Record<string, unknown>;
  const tier = ((ownerMeta.tier as BayiTier) || "starter") as BayiTier;
  const tierConfig = TIER_FEATURES[tier];

  const firma = (ownerMeta.firma_profili as Record<string, unknown>) || {};
  const tenantLocale = (ownerMeta.tenant_locale as Record<string, unknown>) || {};

  // Agent quota
  let quota;
  try {
    quota = await getOrCreateQuota(sb, me.id, tenantId);
  } catch { quota = null; }

  // Counts
  const [empCount, dealerCount, tenantInfo] = await Promise.all([
    sb.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("role", ["admin", "user", "muhasebe", "depocu", "satis", "employee"]),
    sb.from("bayi_dealers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    sb.from("tenants")
      .select("id, name, created_at")
      .eq("id", tenantId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    success: true,
    self: { id: me.id, role: me.role, displayName: me.display_name, isAdmin },
    tenant: {
      id: tenantId,
      name: tenantInfo.data?.name || null,
      createdAt: tenantInfo.data?.created_at || null,
      employeeCount: empCount.count || 0,
      dealerCount: dealerCount.count || 0,
    },
    firma: {
      ticari_unvan: (firma.ticari_unvan as string) || null,
      yetkili_adi: (firma.yetkili_adi as string) || null,
      ofis_telefon: (firma.ofis_telefon as string) || null,
      ofis_adresi: (firma.ofis_adresi as string) || null,
      sektor: (firma.sektor as string) || null,
      vergi_dairesi: (firma.vergi_dairesi as string) || null,
      vergi_no: (firma.vergi_no as string) || null,
      kvk_no: (firma.kvk_no as string) || null,
      iban: (firma.iban as string) || null,
      banka: (firma.banka as string) || null,
      email_kurumsal: (firma.email_kurumsal as string) || null,
      web_sitesi: (firma.web_sitesi as string) || null,
      country: (firma.country as string) || (tenantLocale.country as string) || "NL",
      currency: (tenantLocale.currency as string) || "EUR",
      locale: (tenantLocale.locale as string) || "tr-NL",
      completed: !!ownerMeta.firma_profili_completed,
    },
    plan: {
      tier,
      tierLabel: tier === "starter" ? "Başlangıç" : tier === "growth" ? "Büyüme" : "Pro",
      limits: {
        employees: tierConfig.employees,        // null = sınırsız
        dealers_fair_use: tierConfig.dealersFairUse,
        wa_msg_fair_use_month: tierConfig.waMessagesFairUseMonth,
      },
      features: tierConfig.features,
      support: {
        sla: tierConfig.supportSla,
        response_hours: tierConfig.responseHours,
        concierge_setup: tierConfig.conciergeSetupIncluded,
      },
    },
    quota: quota ? {
      used: quota.row.used_messages,
      limit: quota.limit,
      remaining: quota.remaining,
      percent: quota.percent,
      status: quota.status,
      period_end: quota.row.period_end,
      days_until_reset: quota.days_until_reset,
      plan_key: quota.row.plan_key,
      plan_display: quota.plan_display,
    } : null,
    notification_preferences: {
      // V2'de detaylı toggle UI; şimdilik sadece WA tercihi var/yok bilgisi
      wa_briefing_enabled: !!(ownerMeta.briefing_enabled),
    },
  });
}
