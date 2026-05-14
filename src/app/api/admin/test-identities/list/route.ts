/**
 * GET /api/admin/test-identities/list
 *
 * Admin'in oluşturduğu test identity listesi (son eklenen önce).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("admin_test_identities")
    .select("id, virtual_phone, display_name, target_tenant, notes, created_at")
    .eq("admin_user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin/test-identities/list]", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  return NextResponse.json({ identities: data ?? [] });
}
