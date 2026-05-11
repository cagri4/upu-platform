/**
 * /api/notifications/recent — topbar bell dropdown'u için son N bildirim
 * + okunmamış sayısı.
 *
 * Query: ?limit=10 (default 10, max 50)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") || "10", 10) || 10);
  const sb = getServiceClient();

  const [listRes, countRes] = await Promise.all([
    sb
      .from("notifications")
      .select("id, type, title, body, payload, is_read, created_at, read_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .eq("is_read", false),
  ]);

  return NextResponse.json({
    success: true,
    notifications: listRes.data || [],
    unread_count: countRes.count || 0,
  });
}
