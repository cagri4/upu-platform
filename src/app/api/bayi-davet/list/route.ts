/**
 * GET /api/bayi-davet/list?status=pending|accepted|expired|cancelled|all
 * Dağıtıcının davet listesi. Default: pending.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getTenantByDomain, getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  if (hostTenant?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde kullanılır." }, { status: 400 });
  }

  const bayiCfg = getTenantByKey("bayi");
  if (!bayiCfg) return NextResponse.json({ error: "Bayi config eksik." }, { status: 500 });

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const status = req.nextUrl.searchParams.get("status") || "pending";

  let query = sb
    .from("dealer_invitations")
    .select("id, phone, name, store_name, store_address, status, invite_code, expires_at, accepted_at, created_at")
    .eq("distributor_tenant_id", bayiCfg.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status === "expired") {
    query = query.eq("status", "pending").lt("expires_at", new Date().toISOString());
  } else if (status !== "all") {
    query = query.eq("status", status);
    if (status === "pending") {
      query = query.gte("expires_at", new Date().toISOString());
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("[bayi-davet/list]", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  const rows = (data || []).map((r) => {
    const expMs = new Date(r.expires_at).getTime() - Date.now();
    const daysLeft = Math.max(0, Math.ceil(expMs / (24 * 60 * 60 * 1000)));
    return { ...r, daysLeft };
  });

  return NextResponse.json({ rows, total: rows.length });
}
