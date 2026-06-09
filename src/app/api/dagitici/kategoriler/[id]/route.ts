/**
 * PUT /api/dagitici/kategoriler/[id] — güncelle (name, description, parent_id, sort_order, is_active)
 * DELETE /api/dagitici/kategoriler/[id] — sil (alt kategori veya ürün varsa hata)
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateBody {
  name?: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order?: number | string;
  is_active?: boolean;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as UpdateBody;
  const update: Record<string, unknown> = {};
  if (body.name != null) update.name = body.name.trim();
  if (body.description !== undefined)
    update.description = body.description?.toString().trim() || null;
  if (body.parent_id !== undefined) {
    if (body.parent_id === id) {
      return NextResponse.json({ error: "Kategori kendisi olamaz." }, { status: 400 });
    }
    update.parent_id = body.parent_id || null;
  }
  if (body.sort_order !== undefined) update.sort_order = Number(body.sort_order);
  if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);

  const { error } = await sb
    .from("bayi_categories")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:kategoriler:update]", error);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  // Alt kategori var mı?
  const { count: childCount } = await sb
    .from("bayi_categories")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("parent_id", id);
  if ((childCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "Alt kategoriler var, önce onları sil." },
      { status: 400 },
    );
  }

  // Aktif ürün var mı?
  const { count: prodCount } = await sb
    .from("bayi_products")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("category_id", id)
    .eq("is_active", true);
  if ((prodCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `${prodCount} aktif ürün bu kategoride. Önce ürünleri taşı.` },
      { status: 400 },
    );
  }

  const { error } = await sb
    .from("bayi_categories")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:kategoriler:delete]", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
