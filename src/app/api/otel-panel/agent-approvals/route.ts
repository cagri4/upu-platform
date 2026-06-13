/**
 * /api/otel-panel/agent-approvals — Onay kuyruğu yönetimi (Faz 5)
 *
 * GET: tüm bekleyen + son işlenen onay kayıtları
 * PATCH /[id]: { action: "approve"|"reject"|"edit", edited_content?, rejection_reason? }
 *   - approve → sent (gerçek gönderim FAZ 6'da entegre olacak; şimdilik DB log)
 *   - reject → rejected
 *   - edit → draft_content güncelle (henüz onaylanma)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, approvals: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, approvals: [] });

  const { data: approvals } = await sb
    .from("otel_agent_approvals")
    .select("id, agent_role, action_type, status, draft_content, context, target_channel, target_address, related_entity_id, related_entity_type, approved_at, rejected_at, rejection_reason, sent_at, error_message, created_at")
    .in("hotel_id", hotelIds)
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ success: true, approvals: approvals || [] });
}
