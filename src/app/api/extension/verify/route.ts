import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const supabase = getServiceClient();

  // Support both full token and 6-char short code
  let rec: { user_id: string; expires_at: string | null; token: string } | null = null;

  if (token.length <= 6) {
    // Short code — match against first 6 chars (case-insensitive)
    const { data: rows } = await supabase
      .from("extension_tokens")
      .select("user_id, expires_at, token");
    rec = (rows || []).find(r => r.token.substring(0, 6).toUpperCase() === token.toUpperCase()) || null;
  } else {
    const { data } = await supabase
      .from("extension_tokens")
      .select("user_id, expires_at, token")
      .eq("token", token)
      .single();
    rec = data;
  }

  if (!rec) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  if (rec.expires_at && new Date(rec.expires_at) < new Date()) {
    return NextResponse.json({ error: "Token expired" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", rec.user_id)
    .single();

  return NextResponse.json({ userId: rec.user_id, name: profile?.display_name || "" });
}
