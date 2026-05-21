/**
 * GET /api/billing/status — billing sayfası için tam state.
 *
 * Döner:
 *   - subscription (mevcut sub satırı, sade)
 *   - plans (agent_plans 4 tier — UI grid için)
 *   - invoices (Mollie customer payments — son 12)
 *
 * Admin gerekmez (herkes okur); Mollie iptal/checkout admin'e.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getMollieClient } from "@/platform/billing/bayi-mollie";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["admin", "user"]);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null; invited_by: string | null;
  }>(sb, { userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role, invited_by" });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const ownerId = lookup.profile.invited_by || lookup.profile.id;
  const isAdmin = ADMIN_ROLES.has(lookup.profile.role || "");

  // Mevcut subscription
  const { data: sub } = await sb
    .from("subscriptions")
    .select("user_id, plan, status, amount, currency, current_period_start, current_period_end, cancel_at_period_end, canceled_at, provider_customer_id, provider_subscription_id, trial_ends_at, created_at, updated_at")
    .eq("user_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4 plan tier
  const { data: plans } = await sb
    .from("agent_plans")
    .select("key, display_name, monthly_message_limit, monthly_price_eur, features")
    .order("monthly_price_eur", { ascending: true });

  // Mollie invoices (customer payments) — sadece subscription varsa
  let invoices: Array<{
    id: string; status: string; amount: string; currency: string;
    description: string | null; created_at: string;
    invoice_url: string | null; sequence_type: string | null;
  }> = [];
  if (sub?.provider_customer_id) {
    try {
      const mollie = getMollieClient();
      const list = await mollie.customerPayments.page({
        customerId: sub.provider_customer_id,
        limit: 12,
      });
      invoices = list.map(p => ({
        id: p.id,
        status: p.status,
        amount: p.amount.value,
        currency: p.amount.currency,
        description: p.description || null,
        created_at: p.createdAt,
        invoice_url: p.getCheckoutUrl(),
        sequence_type: p.sequenceType || null,
      }));
    } catch (err) {
      console.error("[billing/status] invoices fetch err", err);
    }
  }

  return NextResponse.json({
    success: true,
    self: { id: lookup.profile.id, role: lookup.profile.role, isAdmin },
    subscription: sub || null,
    plans: (plans || []).map(p => ({
      key: p.key,
      displayName: p.display_name,
      monthlyMessageLimit: p.monthly_message_limit,
      monthlyPriceEur: p.monthly_price_eur !== null ? Number(p.monthly_price_eur) : 0,
      features: p.features || {},
    })),
    invoices,
  });
}
