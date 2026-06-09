/**
 * POST /api/dagitici/siparisler/toplu-onay
 *   body: { order_ids: string[] }
 *
 * Her sipariş için transitionOrderStatus() çağrılır; başarısız olanlar
 * results dizisinde dönder. UI ne kadar başarılı/başarısız gösterir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";
import { transitionOrderStatus } from "@/platform/bayi/order-status";

export const dynamic = "force-dynamic";

interface BulkBody {
  order_ids?: string[];
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as BulkBody;
  const orderIds = (body.order_ids ?? []).filter((x) => typeof x === "string" && x);
  if (orderIds.length === 0) {
    return NextResponse.json({ error: "order_ids gerekli." }, { status: 400 });
  }
  if (orderIds.length > 200) {
    return NextResponse.json({ error: "Maks 200 sipariş aynı anda." }, { status: 400 });
  }

  const results: Array<{ orderId: string; ok: boolean; error?: string }> = [];
  for (const orderId of orderIds) {
    const r = await transitionOrderStatus(sb, {
      tenantId,
      orderId,
      toStatus: "approved",
      profileId,
    });
    results.push({ orderId, ok: r.ok, error: r.error });
  }

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
