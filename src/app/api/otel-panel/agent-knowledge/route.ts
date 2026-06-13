/**
 * /api/otel-panel/agent-knowledge — Bilgi bankası (Faz 5)
 *
 * GET: aktif kayıtlar
 * POST: yeni bilgi
 * PATCH /[id]: güncelle
 * DELETE /[id]: sil
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

async function getHotel(sb: any, userId: string) {
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status };
  const { data: ouh } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .limit(1)
    .maybeSingle();
  if (!ouh?.hotel_id) return { error: "Otel atanmamış", status: 403 };
  return { hotelId: ouh.hotel_id };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const res = await getHotel(sb, auth.userId);
  if ("error" in res) return NextResponse.json({ success: true, items: [] });

  const { data } = await sb
    .from("otel_agent_knowledge")
    .select("id, category, title, content, sort_order, is_active, created_at, updated_at")
    .eq("hotel_id", res.hotelId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  return NextResponse.json({ success: true, items: data || [] });
}

interface PostBody {
  category?: string;
  title?: string;
  content?: string;
  sort_order?: number;
  is_active?: boolean;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: PostBody = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  if (!body.title || !body.content) {
    return NextResponse.json({ error: "title ve content zorunlu" }, { status: 400 });
  }

  const sb = getServiceClient();
  const res = await getHotel(sb, auth.userId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });

  const { data: created, error } = await sb
    .from("otel_agent_knowledge")
    .insert({
      hotel_id: res.hotelId,
      category: body.category || "general",
      title: body.title.trim(),
      content: body.content.trim(),
      sort_order: body.sort_order ?? 100,
      is_active: body.is_active !== false,
    })
    .select("id, category, title, content, sort_order, is_active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, item: created });
}
