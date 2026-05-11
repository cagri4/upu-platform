/**
 * /api/notifications/list — geçmiş sayfası için tam liste + filter.
 *
 * Query:
 *   ?filter=all|today|week|unread (default all)
 *   ?limit=50 (max 200)
 *   ?offset=0
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const url = req.nextUrl;
  const filter = url.searchParams.get("filter") || "all";
  const limit = Math.min(200, parseInt(url.searchParams.get("limit") || "50", 10) || 50);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

  const sb = getServiceClient();
  let q = sb
    .from("notifications")
    .select("id, type, title, body, payload, is_read, created_at, read_at", { count: "exact" })
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filter === "unread") q = q.eq("is_read", false);
  if (filter === "today") {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    q = q.gte("created_at", start.toISOString());
  }
  if (filter === "week") {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    q = q.gte("created_at", cutoff);
  }

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    notifications: data || [],
    total: count || 0,
    limit,
    offset,
  });
}
