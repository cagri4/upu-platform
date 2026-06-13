import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

async function scope(sb: any, userId: string, itemId: string) {
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status };

  const { data: item } = await sb
    .from("otel_agent_knowledge")
    .select("id, hotel_id")
    .eq("id", itemId)
    .single();
  if (!item) return { error: "Kayıt yok", status: 404 };

  const { data: ouh } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .eq("hotel_id", item.hotel_id)
    .maybeSingle();
  if (!ouh) return { error: "Yetkisiz", status: 403 };
  return { item };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body: any = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const chk = await scope(sb, auth.userId, id);
  if ("error" in chk) return NextResponse.json({ error: chk.error }, { status: chk.status });

  const updates: Record<string, any> = {};
  for (const f of ["category", "title", "content", "sort_order", "is_active"]) {
    if (body[f] !== undefined) updates[f] = body[f];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const { data: updated, error } = await sb
    .from("otel_agent_knowledge")
    .update(updates)
    .eq("id", id)
    .select("id, category, title, content, sort_order, is_active")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, item: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const chk = await scope(sb, auth.userId, id);
  if ("error" in chk) return NextResponse.json({ error: chk.error }, { status: chk.status });

  const { error } = await sb.from("otel_agent_knowledge").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
