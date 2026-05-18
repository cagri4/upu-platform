/**
 * GET /api/bayi-davet/validate?code=<invite_code>
 * Davet detay döner (accept sayfası için).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.toUpperCase();
  if (!code) return NextResponse.json({ error: "Davet kodu gerekli." }, { status: 400 });

  const sb = getServiceClient();
  const { data: inv } = await sb
    .from("dealer_invitations")
    .select("id, phone, name, store_name, store_address, status, expires_at, distributor_user_id, distributor_tenant_id")
    .eq("invite_code", code)
    .maybeSingle();

  if (!inv) return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
  if (inv.status !== "pending") {
    return NextResponse.json({ error: `Davet ${inv.status === "accepted" ? "kabul edilmiş" : inv.status === "cancelled" ? "iptal" : "süresi dolmuş"}.` }, { status: 410 });
  }
  if (new Date(inv.expires_at) < new Date()) {
    return NextResponse.json({ error: "Davet süresi dolmuş." }, { status: 410 });
  }

  const { data: distributor } = await sb
    .from("profiles")
    .select("display_name, metadata")
    .eq("id", inv.distributor_user_id)
    .maybeSingle();
  const dMeta = (distributor?.metadata as { firma_profili?: { ticari_unvan?: string } } | null) || null;
  const distributorName = dMeta?.firma_profili?.ticari_unvan || distributor?.display_name || "Dağıtıcı";

  return NextResponse.json({
    ok: true,
    name: inv.name,
    storeName: inv.store_name,
    storeAddress: inv.store_address,
    phone: inv.phone,
    distributorName,
    expiresAt: inv.expires_at,
  });
}
