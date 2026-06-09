/**
 * GET /api/dagitici/fiyat-listeleri/[id] — başlık + içerik (ürün × fiyat + tier'lar).
 * PUT /api/dagitici/fiyat-listeleri/[id] — başlık güncelle.
 * DELETE /api/dagitici/fiyat-listeleri/[id] — sil (items + tiers + atamalar cascade).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: header, error: hErr } = await sb
    .from("bayi_price_lists")
    .select(
      "id, name, description, valid_from, valid_until, is_active, currency, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (hErr) {
    console.error("[dagitici:fiyat-listeleri:get]", hErr);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }
  if (!header) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const { data: items } = await sb
    .from("bayi_price_list_items")
    .select(
      "id, product_id, unit_price, currency, notes, bayi_products(code, name, unit, base_price, is_active)",
    )
    .eq("tenant_id", tenantId)
    .eq("price_list_id", id);

  const itemIds = (items ?? []).map((i) => i.id as string);
  const tiersByItem = new Map<
    string,
    { id: string; minQuantity: number; discountPercent: number }[]
  >();
  if (itemIds.length > 0) {
    const { data: tiers } = await sb
      .from("bayi_price_tiers")
      .select("id, price_list_item_id, min_quantity, discount_percent")
      .eq("tenant_id", tenantId)
      .in("price_list_item_id", itemIds)
      .order("min_quantity", { ascending: true });
    (tiers ?? []).forEach((t) => {
      const k = t.price_list_item_id as string;
      const arr = tiersByItem.get(k) ?? [];
      arr.push({
        id: t.id as string,
        minQuantity: Number(t.min_quantity),
        discountPercent: Number(t.discount_percent),
      });
      tiersByItem.set(k, arr);
    });
  }

  const formattedItems = (items ?? []).map((i) => {
    const raw = i.bayi_products as unknown;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const prod = (arr[0] ?? null) as
      | { code: string; name: string; unit: string; base_price: number; is_active: boolean }
      | null;
    return {
      id: i.id as string,
      productId: i.product_id as string,
      productCode: prod?.code ?? null,
      productName: prod?.name ?? null,
      productUnit: prod?.unit ?? "adet",
      productBasePrice: prod ? Number(prod.base_price) : null,
      productActive: prod ? Boolean(prod.is_active) : null,
      unitPrice: Number(i.unit_price),
      currency: (i.currency as string) || "TRY",
      notes: (i.notes as string) || null,
      tiers: tiersByItem.get(i.id as string) ?? [],
    };
  });

  const list = {
    id: header.id as string,
    name: header.name as string,
    description: (header.description as string) || null,
    validFrom: (header.valid_from as string) || null,
    validUntil: (header.valid_until as string) || null,
    isActive: Boolean(header.is_active),
    currency: (header.currency as string) || "TRY",
    items: formattedItems,
    createdAt: header.created_at as string,
    updatedAt: header.updated_at as string,
  };

  return NextResponse.json({ success: true, list });
}

interface UpdateBody {
  name?: string;
  description?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  currency?: string;
  is_active?: boolean;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name != null) update.name = body.name.trim();
  if (body.description !== undefined)
    update.description = body.description?.toString().trim() || null;
  if (body.valid_from !== undefined) update.valid_from = body.valid_from || null;
  if (body.valid_until !== undefined) update.valid_until = body.valid_until || null;
  if (body.currency !== undefined)
    update.currency = body.currency?.toString().trim() || "TRY";
  if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);

  const { error } = await sb
    .from("bayi_price_lists")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:fiyat-listeleri:update]", error);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { error } = await sb
    .from("bayi_price_lists")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:fiyat-listeleri:delete]", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
