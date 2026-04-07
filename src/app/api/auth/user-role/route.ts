import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("role, dealer_id")
    .eq("id", userId)
    .single();

  return NextResponse.json({ role: data?.role || "admin", dealerId: data?.dealer_id || null });
}
