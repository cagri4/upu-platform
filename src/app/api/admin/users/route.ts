import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  try {
    // NOTE: x-tenant-key is now a tenant *selector* chosen by an authenticated
    // platform admin (cross-tenant by design, cf. /api/admin/stats). It is no
    // longer an authz boundary — requireAdminUser above is the gate.
    const tenantKey = req.headers.get("x-tenant-key") || "emlak";
    const supabase = getServiceClient();

    // Multi-tenant fix (audit #4): .single() multi-row durumunda crash riski
    // taşıyordu (emlak için DEMO + signup tenant'ları olabiliyor). Tüm
    // matching tenant id'leri al, .in() ile filter et.
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("saas_type", tenantKey);

    const tenantIds = (tenants || []).map((t) => t.id as string);

    // Get users
    const query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (tenantIds.length > 0) query.in("tenant_id", tenantIds);
    const { data: users } = await query;

    // Get invite codes
    const invQuery = supabase.from("invite_codes").select("code, status").order("created_at", { ascending: false });
    if (tenantIds.length > 0) invQuery.in("tenant_id", tenantIds);
    const { data: invites } = await invQuery;

    return NextResponse.json({
      users: users || [],
      invites: invites || [],
    });
  } catch (err) {
    console.error("[admin/users]", err);
    return NextResponse.json({ users: [], invites: [] });
  }
}
