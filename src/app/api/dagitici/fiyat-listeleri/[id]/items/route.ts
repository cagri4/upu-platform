/**
 * POST /api/dagitici/fiyat-listeleri/[id]/items — toplu veya tek item ekle.
 *   body: { items: Array<{ product_id, unit_price, currency?, notes?, tiers? }> }
 *     veya tek: { product_id, unit_price, ... }
 *
 * Var olan eşleşmede unit_price güncellenir (upsert).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ItemInput {
  product_id?: string;
  unit_price?: number | string;
  currency?: string;
  notes?: string;
  tiers?: Array<{ min_quantity: number | string; discount_percent: number | string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: priceListId } = await params;

  // Listeyi doğrula (sızıntı önleme)
  const { data: list } = await sb
    .from("bayi_price_lists")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", priceListId)
    .maybeSingle();
  if (!list) return NextResponse.json({ error: "Liste bulunamadı." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const inputs: ItemInput[] = Array.isArray(body.items)
    ? body.items
    : body.product_id
      ? [body]
      : [];

  if (inputs.length === 0) {
    return NextResponse.json({ error: "İtem yok." }, { status: 400 });
  }

  const results: Array<{ productId: string; ok: boolean; error?: string; itemId?: string }> = [];

  for (const inp of inputs) {
    const productId = (inp.product_id || "").trim();
    const unitPrice =
      inp.unit_price == null || inp.unit_price === ""
        ? NaN
        : Number(inp.unit_price);
    if (!productId || isNaN(unitPrice) || unitPrice < 0) {
      results.push({ productId, ok: false, error: "Geçersiz product_id veya fiyat." });
      continue;
    }

    // Ürün tenant'a ait mi?
    const { data: prod } = await sb
      .from("bayi_products")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", productId)
      .maybeSingle();
    if (!prod) {
      results.push({ productId, ok: false, error: "Ürün bulunamadı." });
      continue;
    }

    // Upsert (UNIQUE price_list_id + product_id)
    const { data: upserted, error } = await sb
      .from("bayi_price_list_items")
      .upsert(
        {
          tenant_id: tenantId,
          price_list_id: priceListId,
          product_id: productId,
          unit_price: unitPrice,
          currency: inp.currency?.trim() || "TRY",
          notes: inp.notes?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "price_list_id,product_id" },
      )
      .select("id")
      .single();

    if (error || !upserted) {
      console.error("[dagitici:fiyat-listeleri:items:upsert]", error);
      results.push({ productId, ok: false, error: error?.message || "Upsert hata." });
      continue;
    }

    const itemId = upserted.id as string;

    // Tier'lar varsa eski tier'ları sil + yenileri ekle
    if (Array.isArray(inp.tiers)) {
      await sb
        .from("bayi_price_tiers")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("price_list_item_id", itemId);

      const tierRows = inp.tiers
        .map((t) => ({
          tenant_id: tenantId,
          price_list_item_id: itemId,
          min_quantity: Number(t.min_quantity),
          discount_percent: Number(t.discount_percent),
        }))
        .filter(
          (t) =>
            !isNaN(t.min_quantity) &&
            t.min_quantity >= 1 &&
            !isNaN(t.discount_percent) &&
            t.discount_percent >= 0 &&
            t.discount_percent <= 100,
        );

      if (tierRows.length > 0) {
        const { error: tErr } = await sb.from("bayi_price_tiers").insert(tierRows);
        if (tErr) {
          console.error("[dagitici:fiyat-listeleri:tiers:insert]", tErr);
        }
      }
    }

    results.push({ productId, ok: true, itemId });
  }

  await sb
    .from("bayi_price_lists")
    .update({ updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", priceListId);

  return NextResponse.json({
    success: true,
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      error: results.filter((r) => !r.ok).length,
    },
  });
}
