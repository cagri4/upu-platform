/**
 * GET  /api/bayi/sayim/[id] — sayım satırları (barkod dahil, mobil eşleme için).
 * POST /api/bayi/sayim/[id] — sayılan miktarları senkronla (IndexedDB → server).
 *   body: { items: [{ product_id, counted_qty }] }
 *
 * Mobil sayım: kamerayla barkod okunur, client item listesindeki barcode ile
 * eşleştirir (offline çalışır), adet girilir, IndexedDB'ye yazılır, online
 * olunca bu endpoint'e batch push edilir. Açık oturum şart.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: s } = await sb
    .from("bayi_stocktake_sessions")
    .select("id, title, status, bayi_warehouses(name)")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!s) return NextResponse.json({ error: "Sayım bulunamadı." }, { status: 404 });

  const { data: items } = await sb
    .from("bayi_stocktake_items")
    .select("product_id, expected_qty, counted_qty, bayi_products(code, name, unit, barcode)")
    .eq("tenant_id", tenantId)
    .eq("session_id", id);

  const pick = (raw: unknown): Record<string, unknown> | undefined => {
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return arr[0] as Record<string, unknown> | undefined;
  };

  return NextResponse.json({
    success: true,
    title: s.title as string,
    warehouse: (pick(s.bayi_warehouses)?.name as string) || "—",
    status: s.status as string,
    items: (items ?? []).map((it) => {
      const p = pick(it.bayi_products);
      return {
        productId: it.product_id as string,
        code: (p?.code as string) || "",
        name: (p?.name as string) || "(ürün)",
        unit: (p?.unit as string) || "adet",
        barcode: (p?.barcode as string) || null,
        expected: Number(it.expected_qty) || 0,
        counted: it.counted_qty != null ? Number(it.counted_qty) : null,
      };
    }),
  });
}

interface SyncBody {
  items?: Array<{ product_id?: string; counted_qty?: number | string | null }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: s } = await sb
    .from("bayi_stocktake_sessions")
    .select("status")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!s) return NextResponse.json({ error: "Sayım bulunamadı." }, { status: 404 });
  if (s.status !== "open") {
    return NextResponse.json({ error: "Kapalı sayıma giriş yapılamaz." }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const items = Array.isArray(body.items) ? body.items : [];
  let synced = 0;

  for (const it of items) {
    const pid = (it.product_id || "").toString().trim();
    if (!pid) continue;
    const counted =
      it.counted_qty == null || it.counted_qty === ""
        ? null
        : Math.max(0, Math.floor(Number(it.counted_qty)));
    const { error } = await sb
      .from("bayi_stocktake_items")
      .update({ counted_qty: counted, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("session_id", id)
      .eq("product_id", pid);
    if (!error) synced += 1;
  }

  return NextResponse.json({ success: true, synced });
}
