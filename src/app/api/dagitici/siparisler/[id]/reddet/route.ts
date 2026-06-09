/**
 * POST /api/dagitici/siparisler/[id]/reddet — pending → rejected.
 *   body: { reason: string }  (zorunlu)
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";
import { transitionOrderStatus } from "@/platform/bayi/order-status";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface RejectBody {
  reason?: string;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, profileId } = auth;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as RejectBody;
  const reason = (body.reason || "").trim();
  if (!reason) {
    return NextResponse.json(
      { error: "Red sebebi zorunlu (bayiye gönderilecek)." },
      { status: 400 },
    );
  }

  const result = await transitionOrderStatus(sb, {
    tenantId,
    orderId: id,
    toStatus: "rejected",
    reason,
    profileId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
