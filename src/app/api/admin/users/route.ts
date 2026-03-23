import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tenantKey = req.headers.get("x-tenant-key") || "emlak";
    const supabase = getServiceClient();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("saas_type", tenantKey)
      .single();

    const tenantId = tenant?.id;

    // Get users
    const query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (tenantId) query.eq("tenant_id", tenantId);
    const { data: users } = await query;

    // Get invite codes
    const invQuery = supabase.from("invite_codes").select("code, status").order("created_at", { ascending: false });
    if (tenantId) invQuery.eq("tenant_id", tenantId);
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
