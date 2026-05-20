/**
 * GET /api/bayi-payments/list?status=&scope=mine|tenant
 *
 * Bayi: scope=mine (default) → kendi ödemeleri.
 * Admin/muhasebe: scope=tenant → tüm tenant.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const scope = req.nextUrl.searchParams.get("scope") || "mine";
  const status = req.nextUrl.searchParams.get("status");
  const isAdminScope = scope === "tenant";

  if (isAdminScope && !["admin", "muhasebe"].includes(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Bu listeye yetkiniz yok." }, { status: 403 });
  }

  let query = sb
    .from("bayi_payments")
    .select("id, dealer_user_id, amount, currency, payment_date, dekont_url, notes, status, rejection_reason, approved_at, created_at")
    .eq("tenant_id", lookup.tenantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdminScope) query = query.eq("dealer_user_id", lookup.profile.id);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[bayi-payments/list]", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  // Admin scope: dealer adlarını da getir
  let dealerMap: Record<string, string> = {};
  if (isAdminScope && data && data.length > 0) {
    const ids = Array.from(new Set(data.map((p) => p.dealer_user_id)));
    const { data: dealers } = await sb
      .from("profiles")
      .select("id, display_name, metadata")
      .in("id", ids);
    dealerMap = Object.fromEntries(
      (dealers || []).map((d) => {
        const meta = (d.metadata as Record<string, unknown>) || {};
        const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
        return [d.id, firma?.ticari_unvan || d.display_name || "Bayi"];
      }),
    );
  }

  const rows = (data || []).map((p) => ({
    ...p,
    amount: Number(p.amount),
    dealer_name: dealerMap[p.dealer_user_id] || null,
  }));

  return NextResponse.json({ ok: true, total: rows.length, rows });
}
