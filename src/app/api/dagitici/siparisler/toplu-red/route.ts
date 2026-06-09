/**
 * POST /api/dagitici/siparisler/toplu-red
 *   body: { order_ids: string[], reason: string }
 *
 * Tüm seçili siparişler aynı sebep notu ile reddedilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";
import { transitionOrderStatus } from "@/platform/bayi/order-status";

export const dynamic = "force-dynamic";

interface BulkBody {
  order_ids?: string[];
  reason?: string;
}

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as BulkBody;
  const orderIds = (body.order_ids ?? []).filter((x) => typeof x === "string" && x);
  const reason = (body.reason || "").trim();
  if (orderIds.length === 0) {
    return NextResponse.json({ error: "order_ids gerekli." }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "Red sebebi zorunlu." }, { status: 400 });
  }
  if (orderIds.length > 200) {
    return NextResponse.json({ error: "Maks 200 sipariş aynı anda." }, { status: 400 });
  }

  const results: Array<{ orderId: string; ok: boolean; error?: string }> = [];
  for (const orderId of orderIds) {
    const r = await transitionOrderStatus(sb, {
      tenantId,
      orderId,
      toStatus: "rejected",
      reason,
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
