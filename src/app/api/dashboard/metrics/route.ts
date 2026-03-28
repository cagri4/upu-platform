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

    // Common metrics
    const { count: userCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);

    const { count: subCount } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("status", "active");

    const { count: cmdCount } = await supabase
      .from("bot_activity")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);

    const base = {
      totalUsers: userCount || 0,
      activeSubscriptions: subCount || 0,
      totalCommands: cmdCount || 0,
      tenantName: tenant.name,
    };

    // Tenant-specific metrics
    const extra: Record<string, number | undefined> = {};

    if (tenantKey === "emlak") {
      const { count: propCount } = await supabase
        .from("emlak_properties")
        .select("*", { count: "exact", head: true })
        .eq("user_id", tenant.id);
      const { count: custCount } = await supabase
        .from("emlak_customers")
        .select("*", { count: "exact", head: true });
      extra.propertyCount = propCount ?? 0;
      extra.customerCount = custCount ?? 0;
    }

    if (tenantKey === "bayi") {
      const { count: orderCount } = await supabase
        .from("bayi_orders")
        .select("*", { count: "exact", head: true });
      extra.orderCount = orderCount ?? 0;
    }

    if (tenantKey === "muhasebe") {
      const { count: invCount } = await supabase
        .from("muhasebe_invoices")
        .select("*", { count: "exact", head: true });
      extra.invoiceCount = invCount ?? 0;
    }

    if (tenantKey === "otel") {
      const { count: resCount } = await supabase
        .from("otel_reservations")
        .select("*", { count: "exact", head: true });
      const { count: rmCount } = await supabase
        .from("otel_rooms")
        .select("*", { count: "exact", head: true });
      extra.reservationCount = resCount ?? 0;
      extra.roomCount = rmCount ?? 0;
    }

    if (tenantKey === "market") {
      const { count: prodCount } = await supabase
        .from("market_products")
        .select("*", { count: "exact", head: true });
      extra.productCount = prodCount ?? 0;
    }

    return NextResponse.json({ ...base, ...extra });
  } catch (err) {
    console.error("[dashboard/metrics]", err);
    return NextResponse.json({ totalUsers: 0, activeSubscriptions: 0, totalCommands: 0, tenantName: "" });
  }
}
