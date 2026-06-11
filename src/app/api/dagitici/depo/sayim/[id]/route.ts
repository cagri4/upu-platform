/**
 * GET /api/dagitici/depo/sayim/[id] — oturum detay + satırlar (beklenen/sayılan/fark).
 * PUT /api/dagitici/depo/sayim/[id] — sayılan miktarları kaydet.
 *   body: { items: [{ product_id, counted_qty }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: s } = await sb
    .from("bayi_stocktake_sessions")
    .select("id, title, status, warehouse_id, brand, note, started_at, closed_at, bayi_warehouses(name)")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!s) return NextResponse.json({ error: "Sayım bulunamadı." }, { status: 404 });

  const { data: items } = await sb
    .from("bayi_stocktake_items")
    .select("product_id, expected_qty, counted_qty, bayi_products(code, name, unit)")
    .eq("tenant_id", tenantId)
    .eq("session_id", id);

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  const rows = (items ?? []).map((it) => {
    const p = pick(it.bayi_products);
    const expected = Number(it.expected_qty) || 0;
    const counted = it.counted_qty != null ? Number(it.counted_qty) : null;
    return {
      productId: it.product_id as string,
      code: (p?.code as string) || "",
      name: (p?.name as string) || "(ürün)",
      unit: (p?.unit as string) || "adet",
      expected,
      counted,
      diff: counted != null ? counted - expected : null,
    };
  });

  const warehouse = pick(s.bayi_warehouses)?.name as string;

  return NextResponse.json({
    success: true,
    session: {
      id: s.id as string,
      title: s.title as string,
      status: s.status as string,
      warehouseId: s.warehouse_id as string,
      warehouse: warehouse || "—",
      note: (s.note as string) || null,
      startedAt: s.started_at as string,
      closedAt: (s.closed_at as string) || null,
    },
    items: rows,
  });
}

interface SaveBody {
  items?: Array<{ product_id?: string; counted_qty?: number | string | null }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  // Açık oturum kontrolü
  const { data: s } = await sb
    .from("bayi_stocktake_sessions")
    .select("status")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!s) return NextResponse.json({ error: "Sayım bulunamadı." }, { status: 404 });
  if (s.status !== "open") {
    return NextResponse.json({ error: "Kapalı sayım düzenlenemez." }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as SaveBody;
  const items = Array.isArray(body.items) ? body.items : [];

  for (const it of items) {
    const pid = (it.product_id || "").toString().trim();
    if (!pid) continue;
    const counted =
      it.counted_qty == null || it.counted_qty === ""
        ? null
        : Math.max(0, Math.floor(Number(it.counted_qty)));
    await sb
      .from("bayi_stocktake_items")
      .update({ counted_qty: counted, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("session_id", id)
      .eq("product_id", pid);
  }

  return NextResponse.json({ success: true });
}
