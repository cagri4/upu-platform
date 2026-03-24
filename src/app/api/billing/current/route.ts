import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tenantKey = req.headers.get("x-tenant-key") || "emlak";
    const supabase = getServiceClient();

    // For now, return a placeholder subscription
    // TODO: integrate with actual auth to get current user's subscription
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("saas_type", tenantKey)
      .single();

    if (!tenant) {
      return NextResponse.json({ subscription: null });
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ subscription: sub });
  } catch (err) {
    console.error("[billing/current]", err);
    return NextResponse.json({ subscription: null });
  }
}
