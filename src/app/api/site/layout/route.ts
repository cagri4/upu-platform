/**
 * GET/PATCH /api/site/layout
 *
 * Site panel ana sayfasında Hızlı İşlem + KPI kartların kullanıcı
 * tercih layout'u (in-place edit mode). Veri:
 *   profile.metadata.site_panel_layout = {
 *     quick_actions?: string[],   // null = default, [] = hepsi gizli
 *     kpi_cards?: string[],
 *   }
 *
 * Bayi/emlak panel_layout ile paritetik — multi-tenant pattern: her tenant
 * kendi profile.metadata'sını site_panel_layout key altında tutar.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByDomain } from "@/tenants/config";
import { sanitizeSiteQuickActions } from "@/platform/quick-actions/site-keys";
import { sanitizeSiteKpiCards } from "@/platform/kpi-cards/site-keys";

export const dynamic = "force-dynamic";

interface SitePanelLayout {
  quick_actions?: string[];
  kpi_cards?: string[];
}

interface ProfileMetadata {
  site_panel_layout?: SitePanelLayout;
  [key: string]: unknown;
}

function tenantGuard(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  // Localhost emlak'a düşer — site layout endpoint'i sadece siteyonetim subdomain
  if (hostTenant?.key !== "siteyonetim") {
    return NextResponse.json(
      { error: "Yalnızca site subdomain'inde kullanılır." },
      { status: 400 },
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  const guard = tenantGuard(req);
  if (guard) return guard;

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ metadata: ProfileMetadata | null }>(sb, {
    userId: auth.userId,
    tenantKey: "siteyonetim",
    select: "id, metadata",
  });
  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const layout = lookup.profile.metadata?.site_panel_layout ?? {};
  return NextResponse.json({
    quick_actions: layout.quick_actions ?? null,
    kpi_cards: layout.kpi_cards ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const guard = tenantGuard(req);
  if (guard) return guard;

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

  const updates: SitePanelLayout = {};
  if ("quick_actions" in body) {
    const sanitized = sanitizeSiteQuickActions(body.quick_actions);
    if (sanitized === null) {
      return NextResponse.json({ error: "quick_actions array olmalı." }, { status: 400 });
    }
    updates.quick_actions = sanitized;
  }
  if ("kpi_cards" in body) {
    const sanitized = sanitizeSiteKpiCards(body.kpi_cards);
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
    tenantKey: "siteyonetim",
    select: "id, metadata",
  });
  if ("error" in lookup) {
    return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  }

  const currentMeta = lookup.profile.metadata ?? {};
  const currentLayout = currentMeta.site_panel_layout ?? {};
  const nextLayout: SitePanelLayout = { ...currentLayout, ...updates };
  const nextMeta: ProfileMetadata = { ...currentMeta, site_panel_layout: nextLayout };

  const { error: updErr } = await sb
    .from("profiles")
    .update({ metadata: nextMeta })
    .eq("id", lookup.profile.id);

  if (updErr) {
    console.error("[site/layout PATCH] update error:", updErr);
    return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({
    quick_actions: nextLayout.quick_actions ?? null,
    kpi_cards: nextLayout.kpi_cards ?? null,
  });
}
