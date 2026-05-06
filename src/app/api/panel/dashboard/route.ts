/**
 * /api/panel/dashboard — Dashboard KPI count'ları.
 * Token doğrula + kullanıcının kendi verilerinden 5 sayım.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
  }

  const userId = pt.user_id;

  // Paralel count sorguları
  const [propsRes, custRes, contractsRes, presRes, trackingRes, weekPresRes] = await Promise.all([
    sb.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", userId).neq("status", "deleted"),
    sb.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
    sb.from("contracts").select("*", { count: "exact", head: true }).eq("user_id", userId).neq("status", "cancelled"),
    sb.from("emlak_presentations").select("*", { count: "exact", head: true }).eq("user_id", userId).neq("status", "deleted"),
    sb.from("emlak_tracking_criteria").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("active", true),
    sb.from("emlak_presentations").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  return NextResponse.json({
    success: true,
    kpis: {
      properties: propsRes.count || 0,
      customers: custRes.count || 0,
      contracts: contractsRes.count || 0,
      presentations: presRes.count || 0,
      tracking: trackingRes.count || 0,
      presentations_this_week: weekPresRes.count || 0,
    },
  });
}
