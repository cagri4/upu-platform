/**
 * POST /api/billing/cancel — bayi tenant Mollie subscription iptal.
 *
 * Mollie cancel = recurring durur (period sonuna kadar erişim devam eder).
 * Admin yetkisi gerekli. Body: yok (mevcut subscription'ı kullanır).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getMollieClient } from "@/platform/billing/bayi-mollie";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["admin", "user"]);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; tenant_id: string; role: string | null; invited_by: string | null;
  }>(sb, { userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role, invited_by" });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!ADMIN_ROLES.has(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Admin yetkisi gerekli." }, { status: 403 });
  }

  const ownerId = lookup.profile.invited_by || lookup.profile.id;
  const { data: sub } = await sb
    .from("subscriptions")
    .select("user_id, provider_customer_id, provider_subscription_id, status")
    .eq("user_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub || !sub.provider_subscription_id || !sub.provider_customer_id) {
    return NextResponse.json({ error: "Aktif Mollie aboneliği yok." }, { status: 404 });
  }

  const mollie = getMollieClient();
  try {
    await mollie.customerSubscriptions.cancel(sub.provider_subscription_id, {
      customerId: sub.provider_customer_id,
    });
  } catch (err) {
    console.error("[billing/cancel] mollie cancel err", err);
    return NextResponse.json({ error: "Mollie iptal başarısız." }, { status: 500 });
  }

  await sb.from("subscriptions").update({
    cancel_at_period_end: true,
    canceled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", ownerId);

  return NextResponse.json({ success: true });
}
