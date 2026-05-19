/**
 * GET/PATCH /api/bayi-panel/layout
 *
 * Bayi panel ana sayfasında Hızlı İşlem + KPI kartların kullanıcı
 * tercih layout'u (in-place edit mode). Veri:
 *   profile.metadata.bayi_panel_layout = {
 *     quick_actions?: string[],   // null = default, [] = hepsi gizli
 *     kpi_cards?: string[],
 *   }
 *
 * Emlak panel_layout ile paritetik — multi-tenant pattern: her tenant'ın
 * kendi profile.metadata'sı var, ancak prefix ile karışmasın diye
 * bayi_panel_layout key kullanılır.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByDomain } from "@/tenants/config";
import { sanitizeBayiQuickActions } from "@/platform/quick-actions/bayi-keys";
import { sanitizeBayiKpiCards } from "@/platform/kpi-cards/bayi-keys";

export const dynamic = "force-dynamic";

interface BayiPanelLayout {
  quick_actions?: string[];
  kpi_cards?: string[];
}

interface ProfileMetadata {
  bayi_panel_layout?: BayiPanelLayout;
  [key: string]: unknown;
}

function tenantGuard(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  if (hostTenant?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde kullanılır." }, { status: 400 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const guard = tenantGuard(req);
  if (guard) return guard;

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ metadata: ProfileMetadata | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const layout = lookup.profile.metadata?.bayi_panel_layout ?? {};
  return NextResponse.json({
    quick_actions: layout.quick_actions ?? null,
    kpi_cards: layout.kpi_cards ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const guard = tenantGuard(req);
  if (guard) return guard;

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { quick_actions?: unknown; kpi_cards?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const updates: BayiPanelLayout = {};
  if ("quick_actions" in body) {
    const sanitized = sanitizeBayiQuickActions(body.quick_actions);
    if (sanitized === null) {
      return NextResponse.json({ error: "quick_actions array olmalı." }, { status: 400 });
    }
    updates.quick_actions = sanitized;
  }
  if ("kpi_cards" in body) {
    const sanitized = sanitizeBayiKpiCards(body.kpi_cards);
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
    tenantKey: "bayi",
    select: "id, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const currentMeta = lookup.profile.metadata ?? {};
  const currentLayout = currentMeta.bayi_panel_layout ?? {};
  const nextLayout: BayiPanelLayout = { ...currentLayout, ...updates };
  const nextMeta: ProfileMetadata = { ...currentMeta, bayi_panel_layout: nextLayout };

  const { error: updErr } = await sb
    .from("profiles")
    .update({ metadata: nextMeta })
    .eq("id", lookup.profile.id);

  if (updErr) {
    console.error("[bayi-panel/layout PATCH] update error:", updErr);
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    quick_actions: nextLayout.quick_actions ?? null,
    kpi_cards: nextLayout.kpi_cards ?? null,
  });
}
