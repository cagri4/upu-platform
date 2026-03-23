import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tenantKey = req.headers.get("x-tenant-key") || "emlak";
    const supabase = getServiceClient();

    // Get tenant
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("saas_type", tenantKey)
      .single();

    if (!tenant) {
      return NextResponse.json({ totalUsers: 0, activeSubscriptions: 0, totalCommands: 0, tenantName: "" });
    }

    // User count
    const { count: userCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);

    // Active subscriptions
    const { count: subCount } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "active");

    // Bot activity (commands)
    const { count: cmdCount } = await supabase
      .from("bot_activity")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);

    return NextResponse.json({
      totalUsers: userCount || 0,
      activeSubscriptions: subCount || 0,
      totalCommands: cmdCount || 0,
      tenantName: tenant.name,
    });
  } catch (err) {
    console.error("[dashboard/metrics]", err);
    return NextResponse.json({ totalUsers: 0, activeSubscriptions: 0, totalCommands: 0, tenantName: "" });
  }
}
