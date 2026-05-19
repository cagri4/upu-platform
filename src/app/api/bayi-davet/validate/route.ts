/**
 * GET /api/bayi-davet/validate?code=<invite_code_or_slug>
 *
 * Davet detay döner. İki paralel akış destekler:
 *   - type='dynamic': dealer_invitations.invite_code eşleşir (önceden form
 *     ile üretilen davet, name/phone/store_name vardır)
 *   - type='static': distributor_slugs.slug eşleşir (dağıtıcı evergreen
 *     statik link, bayi form'u kendisi doldurur)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Davet kodu gerekli." }, { status: 400 });

  const sb = getServiceClient();

  // 1) Dynamic invite_code (uppercase) lookup
  const upper = code.toUpperCase();
  const { data: inv } = await sb
    .from("dealer_invitations")
    .select("id, phone, name, store_name, store_address, status, expires_at, distributor_user_id, distributor_tenant_id")
    .eq("invite_code", upper)
    .maybeSingle();

  if (inv) {
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
      type: "dynamic",
      name: inv.name,
      storeName: inv.store_name,
      storeAddress: inv.store_address,
      phone: inv.phone,
      distributorName,
      expiresAt: inv.expires_at,
    });
  }

  // 2) Static slug (lowercase) lookup
  const lower = code.toLowerCase();
  const { data: slugRow } = await sb
    .from("distributor_slugs")
    .select("slug, distributor_user_id, tenant_id, display_name")
    .eq("slug", lower)
    .maybeSingle();

  if (slugRow) {
    return NextResponse.json({
      ok: true,
      type: "static",
      slug: slugRow.slug,
      distributorName: slugRow.display_name || "Dağıtıcı",
    });
  }

  return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
}
