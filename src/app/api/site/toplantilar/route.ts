/**
 * /api/site/toplantilar — Modül 4: Toplantı & Karar (Sprint 3, KMK 634).
 *
 * GET   → Bina toplantıları (status filter ile)
 * POST  → Yeni toplantı çağrısı (KMK 634: yasal 15 gün önce çağrı önerisi)
 * PATCH → Mevcut toplantıyı güncelle (id body'de)
 * DELETE → Toplantıyı iptal (status='iptal' soft delete)
 *
 * KMK 634 yardımcı:
 *   - meeting_type: 'olagan' → çoğunluk %51, 'olaganustu' → %66 (2/3)
 *   - quorum_required_percent default'u meeting_type'a göre.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const SITEYONETIM_TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

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
    .select("id, name, arsa_payi_denominator")
    .eq("manager_id", lookup.profile.id)
    .eq("tenant_id", SITEYONETIM_TENANT_ID)
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
    arsaPayiDenominator: building.arsa_payi_denominator as number | null,
  } as const;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const status = req.nextUrl.searchParams.get("status");
  let query = ctx.sb
    .from("sy_meetings")
    .select("id, title, meeting_type, agenda, scheduled_at, location, invitees, attendees, quorum_required_percent, quorum_actual_percent, status, karar_defteri_pdf_url, created_at")
    .eq("building_id", ctx.buildingId)
    .order("scheduled_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Liste alınamadı." }, { status: 500 });

  return NextResponse.json({
    success: true,
    building: {
      id: ctx.buildingId,
      name: ctx.buildingName,
      arsa_payi_denominator: ctx.arsaPayiDenominator,
    },
    meetings: data || [],
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const scheduled_at = String(body.scheduled_at || "").trim();
  if (!title || !scheduled_at) {
    return NextResponse.json({ error: "Başlık ve tarih zorunlu." }, { status: 400 });
  }

  const meeting_type = String(body.meeting_type || "olagan");
  if (!["olagan", "olaganustu"].includes(meeting_type)) {
    return NextResponse.json({ error: "Geçersiz toplantı türü." }, { status: 400 });
  }

  // KMK 634 default çoğunluk: olağan=51, olağanüstü=66 (2/3)
  const defaultQuorum = meeting_type === "olaganustu" ? 66 : 51;
  const quorum_required_percent = typeof body.quorum_required_percent === "number"
    ? body.quorum_required_percent
    : defaultQuorum;

  // KMK 634 önerisi: tarih 15 gün sonra olmalı
  const scheduledDate = new Date(scheduled_at);
  const daysUntil = Math.floor((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const kmkWarning = daysUntil < 15
    ? `KMK 634 uyarısı: Toplantı çağrısı en az 15 gün önce yapılmalı (şu an ${daysUntil} gün kaldı).`
    : null;

  const { data, error } = await ctx.sb
    .from("sy_meetings")
    .insert({
      tenant_id: SITEYONETIM_TENANT_ID,
      building_id: ctx.buildingId,
      title,
      meeting_type,
      agenda: body.agenda || [],
      scheduled_at,
      location: body.location ? String(body.location) : null,
      invitees: body.invitees || [],
      attendees: [],
      quorum_required_percent,
      status: "cagrildi",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[site/toplantilar POST] error:", error);
    return NextResponse.json({ error: "Eklenemedi: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id, kmk_warning: kmkWarning });
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

  const { data: own } = await ctx.sb
    .from("sy_meetings")
    .select("id, attendees")
    .eq("id", id)
    .eq("building_id", ctx.buildingId)
    .maybeSingle();
  if (!own) return NextResponse.json({ error: "Toplantı bulunamadı." }, { status: 404 });

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["title", "meeting_type", "agenda", "scheduled_at", "location", "invitees", "attendees", "quorum_required_percent", "status", "karar_defteri_pdf_url"]) {
    if (k in body) updatePayload[k] = body[k];
  }

  // attendees değiştiyse quorum hesapla
  if ("attendees" in body && Array.isArray(body.attendees)) {
    const attended = (body.attendees as Array<{ arsa_payi?: number; katildi?: boolean }>)
      .filter((a) => a.katildi)
      .reduce((sum, a) => sum + (a.arsa_payi || 0), 0);
    if (ctx.arsaPayiDenominator && ctx.arsaPayiDenominator > 0) {
      updatePayload.quorum_actual_percent = Math.round((attended / ctx.arsaPayiDenominator) * 10000) / 100;
    }
  }

  const { error } = await ctx.sb
    .from("sy_meetings")
    .update(updatePayload)
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return NextResponse.json({ error: "Güncellenemedi: " + error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveAdminBuilding(req);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  // Soft delete: status='iptal' — toplantı arşivi yasal saklanır
  const { error } = await ctx.sb
    .from("sy_meetings")
    .update({ status: "iptal", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("building_id", ctx.buildingId);

  if (error) return NextResponse.json({ error: "İptal edilemedi." }, { status: 500 });
  return NextResponse.json({ success: true });
}
