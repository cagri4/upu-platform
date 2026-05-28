import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const userId = auth.userId;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("reminders")
    .select("id, topic, note, remind_at, triggered, created_at")
    .eq("user_id", userId)
    .order("remind_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: data || [] });
}
