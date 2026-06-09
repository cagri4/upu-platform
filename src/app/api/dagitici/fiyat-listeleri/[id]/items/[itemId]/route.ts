/**
 * PUT /api/dagitici/fiyat-listeleri/[id]/items/[itemId] — item güncelle (fiyat + tier'lar).
 * DELETE /api/dagitici/fiyat-listeleri/[id]/items/[itemId] — item sil.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

interface UpdateBody {
  unit_price?: number | string;
  currency?: string;
  notes?: string | null;
  tiers?: Array<{ min_quantity: number | string; discount_percent: number | string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: priceListId, itemId } = await params;

  // Item gerçekten bu liste'ye ait mi (ve tenant'ın)?
  const { data: existing } = await sb
    .from("bayi_price_list_items")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .eq("price_list_id", priceListId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Item bulunamadı." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.unit_price !== undefined) {
    const v = Number(body.unit_price);
    if (isNaN(v) || v < 0) {
      return NextResponse.json({ error: "Geçersiz fiyat." }, { status: 400 });
    }
    update.unit_price = v;
  }
  if (body.currency !== undefined)
    update.currency = body.currency?.toString().trim() || "TRY";
  if (body.notes !== undefined)
    update.notes = body.notes?.toString().trim() || null;

  if (Object.keys(update).length > 1) {
    const { error } = await sb
      .from("bayi_price_list_items")
      .update(update)
      .eq("tenant_id", tenantId)
      .eq("id", itemId);
    if (error) {
      console.error("[dagitici:fiyat-listeleri:items:update]", error);
      return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
    }
  }

  // Tier replace
  if (Array.isArray(body.tiers)) {
    await sb
      .from("bayi_price_tiers")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("price_list_item_id", itemId);

    const tierRows = body.tiers
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
        return NextResponse.json({ error: "Kademe kaydedilemedi." }, { status: 500 });
      }
    }
  }

  await sb
    .from("bayi_price_lists")
    .update({ updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", priceListId);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: priceListId, itemId } = await params;

  const { error } = await sb
    .from("bayi_price_list_items")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .eq("price_list_id", priceListId);

  if (error) {
    console.error("[dagitici:fiyat-listeleri:items:delete]", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }

  await sb
    .from("bayi_price_lists")
    .update({ updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", priceListId);

  return NextResponse.json({ success: true });
}
