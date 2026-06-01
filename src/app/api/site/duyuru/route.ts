/**
 * /api/site/duyuru — Modül 3: Duyuru & İletişim (Sprint 3).
 *
 * GET    → Bina duyurularını listele (drafts + sent)
 * POST   → Yeni duyuru oluştur veya hemen gönder (?send=true ise dispatch)
 * PATCH  → Taslak duyuruyu güncelle / send et
 * DELETE → Taslak duyuruyu sil (sent_at IS NULL only)
 *
 * Gönderim: dispatchAnnouncement() — WA template + SMS fallback + inbox.
 * Çağrı 2026-05-27 onayı: provider-agnostic notification layer.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import {
  dispatchAnnouncement,
  type NotificationChannel,
  type NotificationRecipient,
} from "@/platform/notifications/site-channels";

export const dynamic = "force-dynamic";


async function resolveAdminBuilding(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return { error: "Oturum bulunamadı.", status: 401 } as const;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status } as const;

  const { data: building } = await sb
    .from("sy_buildings")
    .select("id, name")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", lookup.tenantId)
    .limit(1)
    .maybeSingle();

  if (!building?.id) {
    return { error: "Yönettiğiniz bir bina bulunamadı.", status: 403 } as const;
  }
  return {
    sb,
    userId: lookup.profile.id,
    buildingId: building.id,
    buildingName: building.name || "Apartman",
  } as const;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const { data, error } = await ctx.sb
    .from("sy_announcements")
    .select("id, title, body, target_scope, target_block, target_role, channels, wa_template_id, scheduled_for, sent_at, total_recipients, read_count, created_at")
    .eq("building_id", ctx.buildingId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[site/duyuru GET] error:", error);
    return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    building: { id: ctx.buildingId, name: ctx.buildingName },
    announcements: data || [],
  });
}

async function gatherRecipients(
  sb: ReturnType<typeof getServiceClient>,
  buildingId: string,
  target_scope: string,
  target_block: string | null,
  _target_role: string | null,
): Promise<NotificationRecipient[]> {
  // Sakin listesi (aktif)
  let query = sb
    .from("sy_residents")
    .select("id, full_name, phone, email, unit_id, sy_units(block)")
    .eq("building_id", buildingId)
    .eq("is_active", true);

  const { data: residents } = await query;
  let filtered = (residents || []) as unknown as Array<{
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    unit_id: string;
    sy_units: { block: string | null } | null;
  }>;

  if (target_scope === "block" && target_block) {
    filtered = filtered.filter((r) => r.sy_units?.block === target_block);
  }
  // target_role filter: V2'de sy_user_residents → profiles.role JOIN
  // V1'de tüm aktif sakinler (target_role bilgi olarak tutulur).

  // sy_user_residents üzerinden user_id eşleştirme (notifications için)
  const residentIds = filtered.map((r) => r.id);
  let userMap = new Map<string, string>();
  if (residentIds.length > 0) {
    const { data: bridges } = await sb
      .from("sy_user_residents")
      .select("user_id, resident_id")
      .in("resident_id", residentIds);
    for (const b of bridges || []) {
      userMap.set(b.resident_id, b.user_id);
    }
  }

  return filtered.map((r) => ({
    user_id: userMap.get(r.id) || r.id,  // fallback resident_id
    phone: r.phone,
    email: r.email,
    display_name: r.full_name,
  }));
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const sendNow = req.nextUrl.searchParams.get("send") === "true";

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const bodyText = String(body.body || "").trim();
  if (!title || !bodyText) {
    return NextResponse.json({ error: "Başlık ve içerik zorunlu." }, { status: 400 });
  }

  const target_scope = String(body.target_scope || "all");
  if (!["all", "block", "role"].includes(target_scope)) {
    return NextResponse.json({ error: "Geçersiz target_scope." }, { status: 400 });
  }

  const target_block = body.target_block ? String(body.target_block) : null;
  const target_role = body.target_role ? String(body.target_role) : null;
  const channels: NotificationChannel[] = Array.isArray(body.channels) && body.channels.length > 0
    ? (body.channels as NotificationChannel[])
    : ["inbox"];
  const wa_template_id = body.wa_template_id ? String(body.wa_template_id) : null;
  const wa_template_vars = (body.wa_template_vars as Record<string, string>) || {};

  // Recipient'leri topla
  const recipients = await gatherRecipients(
    ctx.sb,
    ctx.buildingId,
    target_scope,
    target_block,
    target_role,
  );

  // Insert duyuru
  const { data: inserted, error: insErr } = await ctx.sb
    .from("sy_announcements")
    .insert({
      tenant_id: lookup.tenantId,
      building_id: ctx.buildingId,
      title,
      body: bodyText,
      target_scope,
      target_block,
      target_role,
      channels,
      wa_template_id,
      wa_template_vars,
      sent_at: sendNow ? new Date().toISOString() : null,
      sent_by: sendNow ? ctx.userId : null,
      total_recipients: sendNow ? recipients.length : 0,
    })
    .select("id")
    .single();

  if (insErr) {
    console.error("[site/duyuru POST] insert error:", insErr);
    return NextResponse.json({ error: "Kaydedilemedi: " + insErr.message }, { status: 500 });
  }

  let dispatch_results = null;
  if (sendNow) {
    dispatch_results = await dispatchAnnouncement({
      building_id: ctx.buildingId,
      channels,
      wa_template_id: wa_template_id || undefined,
      wa_template_vars,
      title,
      body: bodyText,
      recipients,
    });
  }

  return NextResponse.json({
    success: true,
    id: inserted.id,
    sent: sendNow,
    total_recipients: sendNow ? recipients.length : null,
    dispatch_results,
  });
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const { data: existing } = await ctx.sb
    .from("sy_announcements")
    .select("id, sent_at, title, body, target_scope, target_block, channels, wa_template_id, wa_template_vars")
    .eq("id", id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Duyuru bulunamadı." }, { status: 404 });
  if (existing.sent_at) return NextResponse.json({ error: "Gönderilmiş duyuru düzenlenemez." }, { status: 409 });

  const sendNow = body.send_now === true;

  // Güncellenecek alanlar
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["title", "body", "target_scope", "target_block", "target_role", "channels", "wa_template_id", "wa_template_vars"]) {
    if (k in body) updatePayload[k] = body[k];
  }

  if (sendNow) {
    const recipients = await gatherRecipients(
      ctx.sb,
      ctx.buildingId,
      (updatePayload.target_scope as string) || existing.target_scope || "all",
      (updatePayload.target_block as string | null) ?? existing.target_block,
      null,
    );
    updatePayload.sent_at = new Date().toISOString();
    updatePayload.sent_by = ctx.userId;
    updatePayload.total_recipients = recipients.length;
  }

  const { error: updErr } = await ctx.sb
    .from("sy_announcements")
    .update(updatePayload)
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (updErr) return NextResponse.json({ error: "Güncellenemedi: " + updErr.message }, { status: 500 });

  let dispatch_results = null;
  if (sendNow) {
    const recipients = await gatherRecipients(
      ctx.sb,
      ctx.buildingId,
      (updatePayload.target_scope as string) || existing.target_scope || "all",
      (updatePayload.target_block as string | null) ?? existing.target_block,
      null,
    );
    const finalChannels = (updatePayload.channels as NotificationChannel[]) || (existing.channels as NotificationChannel[]) || ["inbox"];
    dispatch_results = await dispatchAnnouncement({
      building_id: ctx.buildingId,
      channels: finalChannels,
      wa_template_id: (updatePayload.wa_template_id as string) || existing.wa_template_id || undefined,
      wa_template_vars: (updatePayload.wa_template_vars as Record<string, string>) || (existing.wa_template_vars as Record<string, string>) || {},
      title: (updatePayload.title as string) || existing.title,
      body: (updatePayload.body as string) || existing.body,
      recipients,
    });
  }

  return NextResponse.json({ success: true, sent: sendNow, dispatch_results });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const { data: existing } = await ctx.sb
    .from("sy_announcements")
    .select("id, sent_at")
    .eq("id", id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  if (existing.sent_at) return NextResponse.json({ error: "Gönderilmiş duyuru silinemez." }, { status: 409 });

  const { error } = await ctx.sb
    .from("sy_announcements")
    .delete()
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  return NextResponse.json({ success: true });
}
