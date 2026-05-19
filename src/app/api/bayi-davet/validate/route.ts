/**
 * GET /api/bayi-davet/validate?code=<invite_code>  → dynamic accept
 * GET /api/bayi-davet/validate?tenant=<t>&slug=<s>  → static (tenant + dağıtıcı)
 *
 * İki paralel akış:
 *   - dynamic: dealer_invitations.invite_code eşleşir
 *   - static: distributor_slugs (tenant_slug, slug) composite eşleşir
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const tenantParam = req.nextUrl.searchParams.get("tenant");
  const slugParam = req.nextUrl.searchParams.get("slug");

  if (!code && !(tenantParam && slugParam)) {
    return NextResponse.json({ error: "Davet kodu veya tenant+slug gerekli." }, { status: 400 });
  }

  const sb = getServiceClient();

  // 1) Dynamic invite_code (uppercase) — sadece code parametresi
  if (code) {
    const upper = code.toUpperCase();
    const { data: inv } = await sb
      .from("dealer_invitations")
      .select("id, phone, name, store_name, store_address, status, expires_at, distributor_user_id, distributor_tenant_id")
      .eq("invite_code", upper)
      .maybeSingle();

    if (inv) {
      if (inv.status !== "pending") {
        return NextResponse.json(
          { error: `Davet ${inv.status === "accepted" ? "kabul edilmiş" : inv.status === "cancelled" ? "iptal" : "süresi dolmuş"}.` },
          { status: 410 },
        );
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
    return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
  }

  // 2) Static — tenant + slug composite
  const tenantSlug = (tenantParam || "").toLowerCase();
  const slug = (slugParam || "").toLowerCase();
  const { data: slugRow } = await sb
    .from("distributor_slugs")
    .select("slug, tenant_slug, distributor_user_id, tenant_id, display_name")
    .eq("tenant_slug", tenantSlug)
    .eq("slug", slug)
    .maybeSingle();

  if (slugRow) {
    return NextResponse.json({
      ok: true,
      type: "static",
      tenant_slug: slugRow.tenant_slug,
      slug: slugRow.slug,
      distributorName: slugRow.display_name || "Dağıtıcı",
    });
  }

  return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
}
