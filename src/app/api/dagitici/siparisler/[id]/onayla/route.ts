/**
 * POST /api/dagitici/siparisler/[id]/onayla — pending → approved.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";
import { transitionOrderStatus } from "@/platform/bayi/order-status";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;
  const { id } = await params;

  const result = await transitionOrderStatus(sb, {
    tenantId,
    orderId: id,
    toStatus: "approved",
    profileId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
