import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const userId = auth.userId;

  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("role, dealer_id")
    .eq("id", userId)
    .single();

  // Fail closed: unknown/missing profile gets least privilege, never "admin".
  return NextResponse.json({ role: data?.role || "user", dealerId: data?.dealer_id || null });
}
