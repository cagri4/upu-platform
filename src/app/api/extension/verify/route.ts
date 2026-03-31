import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const supabase = getServiceClient();

  const { data: rec } = await supabase
    .from("extension_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .single();

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
