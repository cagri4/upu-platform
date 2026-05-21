/**
 * GET /api/bayi-referral/info — bayinin referans bilgileri.
 * Döner: code, balance, lifetime_earned, accepted_count, earned_count.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const [codeRes, creditRes, referralsRes] = await Promise.all([
    sb.from("bayi_referral_codes")
      .select("id, code, reward_amount, reward_currency, current_uses, max_uses, expires_at, is_active, created_at")
      .eq("dealer_user_id", lookup.profile.id)
      .eq("is_active", true)
      .maybeSingle(),
    sb.from("bayi_dealer_credits")
      .select("balance, currency, lifetime_earned, lifetime_used, last_movement_at")
      .eq("dealer_user_id", lookup.profile.id)
      .maybeSingle(),
    sb.from("bayi_referrals")
      .select("id, status, referred_name, reward_amount, reward_currency, invited_at, accepted_at, earned_at")
      .eq("referrer_dealer_id", lookup.profile.id)
      .order("invited_at", { ascending: false })
      .limit(50),
  ]);

  const referrals = referralsRes.data || [];
  const counts = {
    accepted: referrals.filter(r => r.status === "accepted").length,
    earned: referrals.filter(r => r.status === "earned").length,
    pending: referrals.filter(r => r.status === "pending").length,
    total: referrals.length,
  };

  return NextResponse.json({
    success: true,
    code: codeRes.data || null,
    credit: creditRes.data || { balance: 0, currency: "TRY", lifetime_earned: 0, lifetime_used: 0 },
    counts,
    referrals,
  });
}
