/**
 * GET /api/bayi-vitrine/leads/list?status=new&limit=50
 * Bayi kendi lead'lerini listeler. Status filter (new/contacted/converted/rejected/all).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["new", "contacted", "converted", "rejected", "expired", "all"]);

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const status = req.nextUrl.searchParams.get("status") || "new";
  const limit = Math.min(200, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)));
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: "Geçersiz status." }, { status: 400 });
  }

  let query = sb
    .from("bayi_leads")
    .select("id, customer_name, customer_phone, customer_email, customer_message, items, est_total, currency, status, source, converted_order_id, created_at, contacted_at, converted_at, rejected_at, notes")
    .eq("dealer_user_id", lookup.profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Counts (top-line)
  const { data: counts } = await sb
    .from("bayi_leads")
    .select("status")
    .eq("dealer_user_id", lookup.profile.id);
  const tally = {
    new: 0, contacted: 0, converted: 0, rejected: 0, expired: 0,
  } as Record<string, number>;
  for (const r of counts || []) {
    tally[r.status as string] = (tally[r.status as string] || 0) + 1;
  }

  return NextResponse.json({
    success: true,
    leads: data || [],
    counts: tally,
    total: counts?.length || 0,
  });
}
