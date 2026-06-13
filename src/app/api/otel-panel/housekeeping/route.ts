/**
 * /api/otel-panel/housekeeping — Housekeeping task listing (Faz 1D)
 *
 * GET: bugün + bekleyen tüm görevler (oda adıyla join)
 * POST: yeni görev ekle (oda + tip + queue_date)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ success: true, tasks: [] });

  const { data: ouhRows } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id);
  const hotelIds = (ouhRows || []).map((r: any) => r.hotel_id).filter(Boolean);
  if (hotelIds.length === 0) return NextResponse.json({ success: true, tasks: [] });

  const { data: tasks } = await sb
    .from("otel_housekeeping_tasks")
    .select("id, room_id, task_type, priority, status, queue_date, notes, assigned_to, otel_rooms(name, room_type)")
    .in("hotel_id", hotelIds)
    .order("queue_date", { ascending: true })
    .order("priority", { ascending: true })
    .limit(100);

  return NextResponse.json({ success: true, tasks: tasks || [] });
}

interface PostBody {
  room_id?: string;
  task_type?: string;
  priority?: number;
  queue_date?: string;
  notes?: string;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: PostBody = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  if (!body.room_id || !body.task_type) {
    return NextResponse.json({ error: "room_id ve task_type zorunlu" }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: room } = await sb
    .from("otel_rooms")
    .select("id, hotel_id")
    .eq("id", body.room_id)
    .single();
  if (!room) return NextResponse.json({ error: "Oda bulunamadı" }, { status: 404 });

  const { data: ouhRow } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", room.hotel_id)
    .maybeSingle();
  if (!ouhRow) return NextResponse.json({ error: "Bu otele yetkiniz yok" }, { status: 403 });

  const { data: created, error } = await sb
    .from("otel_housekeeping_tasks")
    .insert({
      hotel_id: room.hotel_id,
      room_id: body.room_id,
      task_type: body.task_type.trim(),
      priority: body.priority || 2,
      status: "pending",
      queue_date: body.queue_date || new Date().toISOString().slice(0, 10),
      notes: body.notes?.trim() || null,
    })
    .select("id, task_type, priority, status, queue_date")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, task: created });
}
