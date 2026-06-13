/**
 * /api/otel-panel/agent-approvals/[id] — onay aksiyonu (Faz 5)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body: any = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: approval } = await sb
    .from("otel_agent_approvals")
    .select("id, hotel_id, action_type, status, related_entity_id, related_entity_type, target_channel, draft_content")
    .eq("id", id)
    .single();
  if (!approval) return NextResponse.json({ error: "Onay kaydı yok" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", approval.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const now = new Date().toISOString();

  if (body.action === "approve") {
    if (approval.status !== "pending") {
      return NextResponse.json({ error: "Sadece pending onay edilebilir" }, { status: 400 });
    }
    const updates: Record<string, any> = {
      status: "sent", approved_by: lookup.profile.id, approved_at: now, sent_at: now, updated_at: now,
    };
    if (body.edited_content !== undefined) updates.draft_content = body.edited_content;

    // Action-spesifik gönderim (MVP1: review için DB sync; diğerleri log)
    if (approval.action_type === "review_reply" && approval.related_entity_id) {
      await sb.from("otel_external_reviews").update({
        reply_text: updates.draft_content || approval.draft_content,
        reply_status: "published",
        updated_at: now,
      }).eq("id", approval.related_entity_id);
    }
    if (approval.action_type === "create_reservation" && approval.related_entity_id) {
      // Pending rez → confirmed
      await sb.from("otel_reservations").update({
        status: "confirmed", updated_at: now,
      }).eq("id", approval.related_entity_id);
    }
    // Misafir mesajları için MVP2'de gerçek WA/mail gönderim (notification helper)
    // Şimdilik DB log yeterli — sent durumu = sahibi onayladı işareti

    await sb.from("otel_agent_approvals").update(updates).eq("id", id);
    return NextResponse.json({ success: true, status: "sent" });
  }

  if (body.action === "reject") {
    await sb.from("otel_agent_approvals").update({
      status: "rejected",
      rejected_at: now,
      rejection_reason: body.rejection_reason || null,
      updated_at: now,
    }).eq("id", id);

    if (approval.action_type === "review_reply" && approval.related_entity_id) {
      await sb.from("otel_external_reviews").update({
        reply_status: "unanswered", draft_reply: null, updated_at: now,
      }).eq("id", approval.related_entity_id);
    }
    if (approval.action_type === "create_reservation" && approval.related_entity_id) {
      // Pending rez → cancelled
      await sb.from("otel_reservations").update({
        status: "cancelled", updated_at: now,
      }).eq("id", approval.related_entity_id);
    }

    return NextResponse.json({ success: true, status: "rejected" });
  }

  if (body.action === "edit") {
    if (approval.status !== "pending") {
      return NextResponse.json({ error: "Sadece pending düzenlenebilir" }, { status: 400 });
    }
    if (typeof body.edited_content !== "string") {
      return NextResponse.json({ error: "edited_content zorunlu" }, { status: 400 });
    }
    await sb.from("otel_agent_approvals").update({
      draft_content: body.edited_content, updated_at: now,
    }).eq("id", id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
}
