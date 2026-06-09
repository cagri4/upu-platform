/**
 * DELETE /api/dagitici/kampanyalar/[id]/hedefleme/[targetId] — hedef kaldır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../../_auth";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; targetId: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id: campaignId, targetId } = await params;

  const { error } = await sb
    .from("bayi_campaign_targets")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("campaign_id", campaignId)
    .eq("id", targetId);

  if (error) {
    console.error("[dagitici:kampanyalar:hedefleme:delete]", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
