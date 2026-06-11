/**
 * GET    /api/dagitici/depo/[id] — depo detay + stok satırları (ürün × adet).
 * PUT    /api/dagitici/depo/[id] — depo güncelle (ad/adres/sorumlu/default).
 * DELETE /api/dagitici/depo/[id] — devre dışı bırak (soft, is_active=false).
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

  const { data: w, error } = await sb
    .from("bayi_warehouses")
    .select("id, name, address, manager_user_id, is_default, is_active, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[dagitici:depo:get]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }
  if (!w) return NextResponse.json({ error: "Depo bulunamadı." }, { status: 404 });

  // Stok satırları + ürün bilgisi
  const { data: stockRows } = await sb
    .from("bayi_warehouse_stock")
    .select("product_id, quantity, bayi_products(code, name, unit, low_stock_threshold, max_stock_threshold)")
    .eq("tenant_id", tenantId)
    .eq("warehouse_id", id);

  const stock = (stockRows ?? []).map((r) => {
    const raw = r.bayi_products as unknown;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const p = arr[0] as
      | { code?: string; name?: string; unit?: string; low_stock_threshold?: number; max_stock_threshold?: number }
      | undefined;
    const qty = Number(r.quantity) || 0;
    const min = p?.low_stock_threshold != null ? Number(p.low_stock_threshold) : null;
    const max = p?.max_stock_threshold != null ? Number(p.max_stock_threshold) : null;
    return {
      productId: r.product_id as string,
      code: p?.code || "",
      name: p?.name || "(ürün)",
      unit: p?.unit || "adet",
      quantity: qty,
      min,
      max,
      belowMin: min != null && qty <= min,
      aboveMax: max != null && qty >= max,
    };
  });

  return NextResponse.json({
    success: true,
    warehouse: {
      id: w.id as string,
      name: w.name as string,
      address: (w.address as string) || null,
      managerUserId: (w.manager_user_id as string) || null,
      isDefault: Boolean(w.is_default),
      isActive: Boolean(w.is_active),
      createdAt: w.created_at as string,
    },
    stock,
  });
}

interface UpdateBody {
  name?: string;
  address?: string | null;
  manager_user_id?: string | null;
  is_default?: boolean;
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
  if (body.address !== undefined) update.address = body.address?.toString().trim() || null;
  if (body.manager_user_id !== undefined) update.manager_user_id = body.manager_user_id || null;
  if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);

  // Default toggle: tek default garantisi
  if (body.is_default === true) {
    await sb
      .from("bayi_warehouses")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
      .eq("is_default", true);
    update.is_default = true;
  }

  const { error } = await sb
    .from("bayi_warehouses")
    .update(update)
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:depo:update]", error);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  // Soft delete — stok geçmişi/hareket referansları korunur
  const { error } = await sb
    .from("bayi_warehouses")
    .update({ is_active: false, is_default: false, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    console.error("[dagitici:depo:delete]", error);
    return NextResponse.json({ error: "Devre dışı bırakılamadı." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
