/**
 * GET  /api/dagitici/depo/sayim — sayım oturumu listesi (+fark özeti).
 * POST /api/dagitici/depo/sayim — yeni sayım oturumu (depo stoğunu snapshot'lar).
 *   body: { warehouse_id, title, category_id?, brand? }
 *
 * Oturum açılırken seçili depodaki ürünlerin mevcut stoğu expected_qty olarak
 * stocktake_items'a yazılır (counted_qty null). Kategori/marka filtresi
 * opsiyonel. Aynı depoda açık sayım varken yeni açılmaz (uyarı).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const { data, error } = await sb
    .from("bayi_stocktake_sessions")
    .select("id, title, status, warehouse_id, started_at, closed_at, bayi_warehouses(name)")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[dagitici:sayim:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };
  const rows = (data ?? []) as unknown as Array<{
    id: string; title: string; status: string; warehouse_id: string;
    started_at: string; closed_at: string | null; bayi_warehouses: unknown;
  }>;

  // Fark özeti — kapanmış oturumlar için item farklarını say
  const ids = rows.map((r) => r.id);
  const diffCount = new Map<string, number>();
  if (ids.length > 0) {
    const { data: items } = await sb
      .from("bayi_stocktake_items")
      .select("session_id, expected_qty, counted_qty")
      .eq("tenant_id", tenantId)
      .in("session_id", ids);
    for (const it of items ?? []) {
      if (it.counted_qty != null && Number(it.counted_qty) !== Number(it.expected_qty)) {
        const sid = it.session_id as string;
        diffCount.set(sid, (diffCount.get(sid) ?? 0) + 1);
      }
    }
  }

  return NextResponse.json({
    success: true,
    items: rows.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      warehouse: (pick(s.bayi_warehouses)?.name as string) || "—",
      startedAt: s.started_at,
      closedAt: s.closed_at,
      diffCount: diffCount.get(s.id) ?? 0,
    })),
  });
}

interface NewSessionBody {
  warehouse_id?: string;
  title?: string;
  category_id?: string;
  brand?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as NewSessionBody;
  const warehouseId = (body.warehouse_id || "").trim();
  const title = (body.title || "").trim();
  if (!warehouseId || !title) {
    return NextResponse.json({ error: "Depo ve başlık zorunlu." }, { status: 400 });
  }

  const { data: wh } = await sb
    .from("bayi_warehouses")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", warehouseId)
    .maybeSingle();
  if (!wh) return NextResponse.json({ error: "Depo bulunamadı." }, { status: 404 });

  // Aynı depoda açık sayım var mı
  const { data: open } = await sb
    .from("bayi_stocktake_sessions")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("warehouse_id", warehouseId)
    .eq("status", "open")
    .maybeSingle();
  if (open) {
    return NextResponse.json(
      { error: "Bu depoda zaten açık bir sayım var. Önce onu kapat." },
      { status: 409 },
    );
  }

  // Oturum
  const { data: session, error: sErr } = await sb
    .from("bayi_stocktake_sessions")
    .insert({
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      title,
      status: "open",
      category_id: body.category_id || null,
      brand: body.brand?.trim() || null,
      started_by: profileId,
    })
    .select("id")
    .single();

  if (sErr || !session) {
    console.error("[dagitici:sayim:create]", sErr);
    return NextResponse.json({ error: "Oluşturulamadı." }, { status: 400 });
  }

  // Snapshot — depodaki ürünlerin mevcut stoğu expected_qty
  let stockQuery = sb
    .from("bayi_warehouse_stock")
    .select("product_id, quantity, bayi_products(category_id, brand)")
    .eq("tenant_id", tenantId)
    .eq("warehouse_id", warehouseId);
  const { data: stockRows } = await stockQuery;

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  const itemsToInsert = (stockRows ?? [])
    .filter((r) => {
      const p = pick(r.bayi_products);
      if (body.category_id && p?.category_id !== body.category_id) return false;
      if (body.brand && p?.brand !== body.brand) return false;
      return true;
    })
    .map((r) => ({
      tenant_id: tenantId,
      session_id: session.id as string,
      product_id: r.product_id as string,
      expected_qty: Number(r.quantity) || 0,
      counted_qty: null as number | null,
    }));

  if (itemsToInsert.length > 0) {
    await sb.from("bayi_stocktake_items").insert(itemsToInsert);
  }

  return NextResponse.json({ success: true, id: session.id, itemCount: itemsToInsert.length });
}
