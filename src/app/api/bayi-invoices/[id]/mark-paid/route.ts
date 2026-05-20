/**
 * POST /api/bayi-invoices/[id]/mark-paid — admin/muhasebe fatura ödendi işaretler.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }

  const { id } = await params;
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  if (!["admin", "muhasebe"].includes(lookup.profile.role || "")) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }

  const { data, error } = await sb
    .from("bayi_invoices")
    .update({ status: "paid" })
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId)
    .in("status", ["open", "overdue"])
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Fatura bulunamadı veya zaten ödendi." }, { status: 404 });

  return NextResponse.json({ ok: true, status: "paid" });
}
