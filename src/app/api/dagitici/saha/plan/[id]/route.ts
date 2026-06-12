/**
 * PATCH  /api/dagitici/saha/plan/[id] — plan güncelle (date/time/note/status).
 * DELETE /api/dagitici/saha/plan/[id] — plan sil.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../../_auth";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const STATUSES = ["planned", "done", "skipped"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PatchBody {
  planned_date?: string;
  planned_time?: string;
  note?: string;
  status?: string;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  const { data: plan } = await sb
    .from("bayi_visit_plans")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!plan) return NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.planned_date === "string") {
    if (!DATE_RE.test(body.planned_date)) {
      return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
    }
    patch.planned_date = body.planned_date;
  }
  if (typeof body.planned_time === "string") {
    if (body.planned_time && !TIME_RE.test(body.planned_time)) {
      return NextResponse.json({ error: "Geçersiz saat." }, { status: 400 });
    }
    patch.planned_time = body.planned_time || null;
  }
  if (typeof body.note === "string") patch.note = body.note.trim() || null;
  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
    }
    patch.status = body.status;
  }

  await sb.from("bayi_visit_plans").update(patch).eq("tenant_id", tenantId).eq("id", id);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;
  const { id } = await params;

  await sb.from("bayi_visit_plans").delete().eq("tenant_id", tenantId).eq("id", id);
  return NextResponse.json({ success: true });
}
