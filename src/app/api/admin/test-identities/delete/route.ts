/**
 * POST /api/admin/test-identities/delete
 *
 * Body: { id }
 * Sadece sahip admin silebilir (admin_user_id eşleşmesi).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  }

  const sb = getServiceClient();
  const { error, count } = await sb
    .from("admin_test_identities")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("admin_user_id", auth.userId);

  if (error) {
    console.error("[admin/test-identities/delete]", error);
    return NextResponse.json({ error: "Silme başarısız." }, { status: 500 });
  }

  if (!count) {
    return NextResponse.json({ error: "Kayıt bulunamadı veya yetkiniz yok." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
