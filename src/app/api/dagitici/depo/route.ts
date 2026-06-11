/**
 * GET  /api/dagitici/depo — depo listesi (+ürün/stok özeti).
 * POST /api/dagitici/depo — yeni depo oluştur.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const { data: warehouses, error } = await sb
    .from("bayi_warehouses")
    .select("id, name, address, manager_user_id, is_default, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[dagitici:depo:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  // Her depo için ürün çeşidi + toplam adet özeti
  const ids = (warehouses ?? []).map((w) => w.id as string);
  const summary = new Map<string, { skuCount: number; totalQty: number }>();
  if (ids.length > 0) {
    const { data: stock } = await sb
      .from("bayi_warehouse_stock")
      .select("warehouse_id, quantity")
      .eq("tenant_id", tenantId)
      .in("warehouse_id", ids);
    for (const s of stock ?? []) {
      const wid = s.warehouse_id as string;
      const cur = summary.get(wid) || { skuCount: 0, totalQty: 0 };
      cur.skuCount += 1;
      cur.totalQty += Number(s.quantity) || 0;
      summary.set(wid, cur);
    }
  }

  return NextResponse.json({
    success: true,
    items: (warehouses ?? []).map((w) => ({
      id: w.id as string,
      name: w.name as string,
      address: (w.address as string) || null,
      managerUserId: (w.manager_user_id as string) || null,
      isDefault: Boolean(w.is_default),
      isActive: Boolean(w.is_active),
      createdAt: w.created_at as string,
      skuCount: summary.get(w.id as string)?.skuCount ?? 0,
      totalQty: summary.get(w.id as string)?.totalQty ?? 0,
    })),
  });
}

interface NewWarehouseBody {
  name?: string;
  address?: string;
  manager_user_id?: string;
  is_default?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewWarehouseBody;
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "Depo adı zorunlu." }, { status: 400 });
  }

  // İlk depo otomatik default; ya da body.is_default
  const { count } = await sb
    .from("bayi_warehouses")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const makeDefault = body.is_default === true || (count ?? 0) === 0;

  // Tek default garantisi: yeni default ise eskileri düşür
  if (makeDefault) {
    await sb
      .from("bayi_warehouses")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
      .eq("is_default", true);
  }

  const { data, error } = await sb
    .from("bayi_warehouses")
    .insert({
      tenant_id: tenantId,
      name,
      address: body.address?.trim() || null,
      manager_user_id: body.manager_user_id || null,
      is_default: makeDefault,
      is_active: true,
      created_by: profileId,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[dagitici:depo:create]", error);
    return NextResponse.json({ error: "Oluşturulamadı." }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
