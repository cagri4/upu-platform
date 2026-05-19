/**
 * GET /api/kullanici-davet/validate?token=<invite_token>
 *
 * Davet detay döner — accept sayfası için. Bot komutu ile entegre olduğunda
 * aynı endpoint kullanılır (bot da invite_token validate eder).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "Yönetici",
  muhasebe: "Muhasebe",
  depocu: "Depo",
  satis: "Satış",
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Davet token gerekli." }, { status: 400 });

  const sb = getServiceClient();
  const { data: inv } = await sb
    .from("user_invitations")
    .select("id, invitee_name, invitee_phone, role, status, expires_at, inviter_user_id, tenant_id")
    .eq("invite_token", token)
    .maybeSingle();

  if (!inv) return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
  if (inv.status !== "pending") {
    return NextResponse.json(
      { error: `Davet ${inv.status === "accepted" ? "kabul edilmiş" : inv.status === "cancelled" ? "iptal" : "süresi dolmuş"}.` },
      { status: 410 },
    );
  }
  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: "Davet süresi dolmuş." }, { status: 410 });
  }

  // Inviter / firma adı
  const { data: inviter } = await sb
    .from("profiles")
    .select("display_name, metadata")
    .eq("id", inv.inviter_user_id)
    .maybeSingle();
  const meta = (inviter?.metadata as Record<string, unknown> | null) || {};
  const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
  const inviterName = firma?.ticari_unvan || inviter?.display_name || "Şirketiniz";

  return NextResponse.json({
    ok: true,
    name: inv.invitee_name,
    phone: inv.invitee_phone,
    role: inv.role,
    role_label: ROLE_LABEL[inv.role] || inv.role,
    inviterName,
    expiresAt: inv.expires_at,
  });
}
