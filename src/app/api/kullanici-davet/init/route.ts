/**
 * GET /api/bayi-calisan-davet/init — validate token and return the
 * list of capabilities the owner can grant. The page renders grouped
 * checkboxes from the labels; the token is not invalidated here so the
 * owner can tweak/resubmit without losing the link.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { BAYI_CAPABILITIES, CAPABILITY_LABELS, DEALER_PRESET, POSITION_PRESETS } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{ display_name: string | null; tenant_id: string }>(supabase, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "display_name, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const owner = lookup.profile;

  // Build capability groups for the checkbox UI. Dealer-only "*_OWN"
  // scopes are excluded; owners invite employees, not dealers.
  const DEALER_ONLY = new Set<string>([
    BAYI_CAPABILITIES.ORDERS_VIEW_OWN,
    BAYI_CAPABILITIES.FINANCE_BALANCE_OWN,
    BAYI_CAPABILITIES.FINANCE_INVOICES_OWN,
  ]);

  const groups: Record<string, { id: string; label: string }[]> = {};
  for (const [key, meta] of Object.entries(CAPABILITY_LABELS)) {
    if (DEALER_ONLY.has(key)) continue;
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push({ id: key, label: meta.label });
  }

  // Pozisyon presetleri (Faz 3): owner formdan dropdown ile pozisyon
  // seçer, checkbox listesi pre-fill olur. Dealer-only kapsamlar dahil
  // değil (owner çalışan davet ediyor, bayi değil).
  const positions: Array<{ id: string; label: string; capabilities: string[] }> = [];
  for (const [key, value] of Object.entries(POSITION_PRESETS)) {
    if (key === "dealer_employee") continue; // bu preset bayi sahibinin kendi çalışanı için, ayrı akış
    positions.push({
      id: key,
      label: value.label,
      capabilities: [...value.preset],
    });
  }

  return NextResponse.json({
    success: true,
    ownerName: owner?.display_name || "",
    groups,
    positions,
    presets: {
      dealer: DEALER_PRESET,
    },
  });
}
