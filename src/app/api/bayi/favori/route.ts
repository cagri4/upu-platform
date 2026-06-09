/**
 * GET /api/bayi/favori — favori ürün id listesi.
 * POST /api/bayi/favori — toggle.
 *   body: { product_id }
 *   Var ise siler, yoksa ekler. Sonuçta { active: boolean } döner.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const { data, error } = await sb
    .from("bayi_favorites")
    .select("product_id, created_at")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[bayi:favori:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    items: (data ?? []).map((f) => ({
      productId: f.product_id as string,
      createdAt: f.created_at as string,
    })),
  });
}

interface ToggleBody {
  product_id?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as ToggleBody;
  const productId = (body.product_id || "").trim();
  if (!productId) {
    return NextResponse.json({ error: "product_id zorunlu." }, { status: 400 });
  }

  // Ürün tenant'a ait mi?
  const { data: prod } = await sb
    .from("bayi_products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();
  if (!prod) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });

  // Dealer (varsa)
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  const dealerId = (dealer?.id as string) || null;

  // Var mı?
  const { data: existing } = await sb
    .from("bayi_favorites")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await sb
      .from("bayi_favorites")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", existing.id);
    return NextResponse.json({ success: true, active: false });
  }

  const { error } = await sb.from("bayi_favorites").insert({
    tenant_id: tenantId,
    dealer_id: dealerId,
    user_id: userId,
    product_id: productId,
  });
  if (error) {
    console.error("[bayi:favori:toggle:insert]", error);
    return NextResponse.json({ error: "Eklenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true, active: true });
}
