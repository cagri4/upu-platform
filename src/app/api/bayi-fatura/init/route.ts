/**
 * GET /api/bayi-fatura/init — validate token + return the invoice list
 * scoped to the caller.
 *  - Owner (FINANCE_INVOICES or wildcard): all tenant invoices.
 *  - Dealer (FINANCE_INVOICES_OWN): only their own.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    tenant_id: string;
    capabilities: string[] | null;
    dealer_id: string | null;
    role: string | null;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, capabilities, dealer_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const profile = lookup.profile;

  const caps = (profile.capabilities as string[] | null) || [];
  const canSeeAll = caps.includes("*") || caps.includes(BAYI_CAPABILITIES.FINANCE_INVOICES);
  const canSeeOwn = caps.includes(BAYI_CAPABILITIES.FINANCE_INVOICES_OWN);

  if (!canSeeAll && !canSeeOwn) {
    return NextResponse.json({ error: "Fatura görüntüleme yetkiniz yok." }, { status: 403 });
  }

  // Schema used across commands: invoice_number + total_amount + invoice_date
  // + is_paid + due_date. Select "*" to tolerate schema drift; API
  // normalises fields below.
  let q = supabase
    .from("bayi_dealer_invoices")
    .select("*, bayi_dealers(company_name)")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (!canSeeAll) {
    if (!profile.dealer_id) {
      return NextResponse.json({ success: true, invoices: [], canMarkPaid: false, isOwnerView: false });
    }
    q = q.eq("dealer_id", profile.dealer_id);
  }

  const { data: invoices } = await q.limit(200);

  return NextResponse.json({
    success: true,
    isOwnerView: canSeeAll,
    canMarkPaid: canSeeAll || caps.includes(BAYI_CAPABILITIES.FINANCE_PAYMENTS),
    invoices: (invoices || []).map((inv: Record<string, unknown>) => ({
      id: inv.id as string,
      invoice_no: (inv.invoice_number as string) || (inv.invoice_no as string) || "",
      amount: Number((inv.total_amount as number) || (inv.amount as number) || 0),
      is_paid: !!inv.is_paid,
      due_date: (inv.due_date as string) || (inv.invoice_date as string) || (inv.created_at as string),
      created_at: inv.created_at as string,
      dealer_name: (inv.bayi_dealers as unknown as { company_name?: string } | null)?.company_name || null,
    })),
  });
}
