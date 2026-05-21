/**
 * GET /api/recommendations/list — kullanıcının aktif önerileri.
 * Query: ?status=open|acted|dismissed|all (default open), ?limit=20
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const status = req.nextUrl.searchParams.get("status") || "open";
  const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10) || 20);

  const sb = getServiceClient();
  let q = sb.from("recommendation_runs")
    .select("id, rule_code, title, body, action_type, action_payload, severity, score, status, created_at, expires_at, acted_at, dismissed_at, target_ids")
    .eq("user_id", auth.userId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, recommendations: data || [] });
}
