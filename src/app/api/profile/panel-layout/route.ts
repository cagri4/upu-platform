/**
 * GET/PATCH /api/profile/panel-layout
 *
 * Panel ana sayfasındaki Hızlı İşlem + KPI kartlarının kullanıcı tarafından
 * gizlenmesi / eklenmesi (in-place edit mode). Veri:
 *   profile.metadata.panel_layout = {
 *     quick_actions?: string[],   // null = default, [] = hepsi gizli
 *     kpi_cards?: string[],
 *   }
 *
 * Multi-tenant aware: profile lookup resolveTenantProfile helper'ı
 * üzerinden (auth_user_id || id + tenant_id) — eski "eq(id, uid)"
 * pattern'i yeni multi-tenant kayıtlarda 0 row dönüyordu.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";
import { sanitizeQuickActions } from "@/platform/quick-actions/keys";
import { sanitizeKpiCards } from "@/platform/kpi-cards/keys";

export const dynamic = "force-dynamic";

interface PanelLayout {
  quick_actions?: string[];
  kpi_cards?: string[];
}

interface ProfileMetadata {
  panel_layout?: PanelLayout;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = getServiceClient();
  const lookup = await resolveTenantProfile<{ metadata: ProfileMetadata | null }>(
    admin,
    { userId: auth.userId, select: "id, metadata" },
  );

  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const layout = lookup.profile.metadata?.panel_layout ?? {};
  return NextResponse.json({
    quick_actions: layout.quick_actions ?? null,
    kpi_cards: layout.kpi_cards ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { quick_actions?: unknown; kpi_cards?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const updates: PanelLayout = {};
  if ("quick_actions" in body) {
    const sanitized = sanitizeQuickActions(body.quick_actions);
    if (sanitized === null) {
      return NextResponse.json({ error: "quick_actions array olmalı." }, { status: 400 });
    }
    updates.quick_actions = sanitized;
  }
  if ("kpi_cards" in body) {
    const sanitized = sanitizeKpiCards(body.kpi_cards);
    if (sanitized === null) {
      return NextResponse.json({ error: "kpi_cards array olmalı." }, { status: 400 });
    }
    updates.kpi_cards = sanitized;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncelleme alanı yok." }, { status: 400 });
  }

  const admin = getServiceClient();
  const lookup = await resolveTenantProfile<{ metadata: ProfileMetadata | null }>(
    admin,
    { userId: auth.userId, select: "id, metadata" },
  );

  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const currentMeta = lookup.profile.metadata ?? {};
  const currentLayout = currentMeta.panel_layout ?? {};
  const nextLayout: PanelLayout = { ...currentLayout, ...updates };
  const nextMeta: ProfileMetadata = { ...currentMeta, panel_layout: nextLayout };

  const { error: updErr } = await admin
    .from("profiles")
    .update({ metadata: nextMeta })
    .eq("id", lookup.profile.id);

  if (updErr) {
    console.error("[panel-layout PATCH] update error:", updErr);
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    quick_actions: nextLayout.quick_actions ?? null,
    kpi_cards: nextLayout.kpi_cards ?? null,
  });
}
