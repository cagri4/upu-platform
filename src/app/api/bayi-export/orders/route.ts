/**
 * GET /api/bayi-export/orders — sipariş listesi Excel export.
 * Admin/satis: tenant scope, bayi: kendi siparişleri.
 */
import { NextRequest } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { buildXlsx, xlsxResponse } from "@/platform/bayi-finansal/excel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return new Response("forbidden", { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return new Response(auth.error, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role",
  });
  if ("error" in lookup) return new Response(lookup.error, { status: lookup.status });

  const isAdminScope = ["admin", "satis"].includes(lookup.profile.role || "");

  let query = sb
    .from("bayi_dealer_orders")
    .select("id, status, total_amount, created_at, dealer_user_id, notes")
    .eq("tenant_id", lookup.tenantId)
    .order("created_at", { ascending: false });

  if (!isAdminScope) query = query.eq("dealer_user_id", lookup.profile.id);

  const { data, error } = await query;
  if (error) return new Response("query failed", { status: 500 });

  let dealerMap: Record<string, string> = {};
  if (isAdminScope && data) {
    const ids = Array.from(new Set(data.map((r) => r.dealer_user_id)));
    const { data: dealers } = await sb.from("profiles").select("id, display_name, metadata").in("id", ids);
    dealerMap = Object.fromEntries((dealers || []).map((d) => {
      const meta = (d.metadata as Record<string, unknown>) || {};
      const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
      return [d.id, firma?.ticari_unvan || d.display_name || "Bayi"];
    }));
  }

  const rows = (data || []).map((r) => ({
    tarih: new Date(r.created_at as string).toLocaleDateString("tr-TR"),
    siparis_no: `#${(r.id as string).slice(0, 8)}`,
    bayi: dealerMap[r.dealer_user_id as string] || "—",
    durum: r.status,
    tutar: Number(r.total_amount),
    not: r.notes || "",
  }));

  const buffer = await buildXlsx({
    sheetName: "Siparişler",
    columns: [
      { header: "Tarih",     key: "tarih",     width: 14 },
      { header: "Sipariş No",key: "siparis_no",width: 14 },
      { header: "Bayi",      key: "bayi",      width: 28 },
      { header: "Durum",     key: "durum",     width: 14 },
      { header: "Tutar",     key: "tutar",     width: 14, money: true },
      { header: "Not",       key: "not",       width: 30 },
    ],
    rows,
  });

  return xlsxResponse(buffer, `siparisler-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
