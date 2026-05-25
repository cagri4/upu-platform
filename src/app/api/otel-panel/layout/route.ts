/**
 * GET/PATCH /api/otel-panel/layout
 *
 * Otel panel ana sayfasında Hızlı İşlem + KPI kartların kullanıcı tercih
 * layout'u (in-place edit mode). Veri:
 *   profile.metadata.otel_panel_layout = {
 *     quick_actions?: string[],   // null = default, [] = hepsi gizli
 *     kpi_cards?: string[],
 *   }
 *
 * Emlak/bayi panel_layout ile paritetik — multi-tenant pattern: her tenant'ın
 * kendi profile.metadata key'i var (otel_panel_layout).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";
import { sanitizeOtelQuickActions } from "@/platform/quick-actions/otel-keys";
import { sanitizeOtelKpiCards } from "@/platform/kpi-cards/otel-keys";

export const dynamic = "force-dynamic";

interface OtelPanelLayout {
  quick_actions?: string[];
  kpi_cards?: string[];
}

interface ProfileMetadata {
  otel_panel_layout?: OtelPanelLayout;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ metadata: ProfileMetadata | null }>(sb, {
    userId: auth.userId,
    tenantKey: "otel",
    select: "id, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const layout = lookup.profile.metadata?.otel_panel_layout ?? {};
  return NextResponse.json({
    quick_actions: layout.quick_actions ?? null,
    kpi_cards: layout.kpi_cards ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  let body: { quick_actions?: unknown; kpi_cards?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const updates: OtelPanelLayout = {};
  if ("quick_actions" in body) {
    const sanitized = sanitizeOtelQuickActions(body.quick_actions);
    if (sanitized === null) {
      return NextResponse.json({ error: "quick_actions array olmalı." }, { status: 400 });
    }
    updates.quick_actions = sanitized;
  }
  if ("kpi_cards" in body) {
    const sanitized = sanitizeOtelKpiCards(body.kpi_cards);
    if (sanitized === null) {
      return NextResponse.json({ error: "kpi_cards array olmalı." }, { status: 400 });
    }
    updates.kpi_cards = sanitized;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncelleme alanı yok." }, { status: 400 });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ metadata: ProfileMetadata | null }>(sb, {
    userId: auth.userId,
    tenantKey: "otel",
    select: "id, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const currentMeta = lookup.profile.metadata ?? {};
  const currentLayout = currentMeta.otel_panel_layout ?? {};
  const nextLayout: OtelPanelLayout = { ...currentLayout, ...updates };
  const nextMeta: ProfileMetadata = { ...currentMeta, otel_panel_layout: nextLayout };

  const { error: updErr } = await sb
    .from("profiles")
    .update({ metadata: nextMeta })
    .eq("id", lookup.profile.id);

  if (updErr) {
    console.error("[otel-panel/layout PATCH] update error:", updErr);
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    quick_actions: nextLayout.quick_actions ?? null,
    kpi_cards: nextLayout.kpi_cards ?? null,
  });
}
