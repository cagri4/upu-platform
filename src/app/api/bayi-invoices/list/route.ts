/**
 * GET /api/bayi-invoices/list?status=&scope=mine|tenant
 *
 * Bayi: scope=mine → kendi faturaları. Admin/muhasebe: scope=tenant.
 * status filter: open|paid|overdue|cancelled.
 * Otomatik overdue tespiti: status='open' AND due_date < today.
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
    .from("bayi_invoices")
    .select("id, dealer_user_id, invoice_no, issue_date, due_date, amount, currency, pdf_url, status, notes, created_at")
    .eq("tenant_id", lookup.tenantId)
    .order("due_date", { ascending: true })
    .limit(500);

  if (!isAdminScope) query = query.eq("dealer_user_id", lookup.profile.id);
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[bayi-invoices/list]", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  // Dealer adlarını birlikte getir
  let dealerMap: Record<string, string> = {};
  if (isAdminScope && data && data.length > 0) {
    const ids = Array.from(new Set(data.map((r) => r.dealer_user_id)));
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

  const today = new Date().toISOString().slice(0, 10);
  const rows = (data || []).map((r) => {
    const isOverdue = r.status === "open" && r.due_date < today;
    const dueMs = new Date(r.due_date).getTime() - Date.now();
    return {
      ...r,
      amount: Number(r.amount),
      dealer_name: dealerMap[r.dealer_user_id] || null,
      effective_status: isOverdue ? "overdue" : r.status,
      days_to_due: Math.ceil(dueMs / 86400000),
    };
  });

  return NextResponse.json({ ok: true, total: rows.length, rows });
}
