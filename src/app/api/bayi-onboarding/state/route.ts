/**
 * GET  /api/bayi-onboarding/state — current onboarding state
 * POST /api/bayi-onboarding/state — { step, skipped } step ilerlet
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string;
    tenant_id: string;
    onboarding_completed: boolean;
    onboarding_step: number;
    onboarding_completed_at: string | null;
    display_name: string | null;
    metadata: Record<string, unknown> | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, tenant_id, onboarding_completed, onboarding_step, onboarding_completed_at, display_name, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const meta = (lookup.profile.metadata || {}) as Record<string, unknown>;
  const firma = (meta.firma_profili || {}) as Record<string, unknown>;
  const firmaUnvani = (firma.ticari_unvan as string) || (meta.company_name as string) || null;

  return NextResponse.json({
    success: true,
    completed: lookup.profile.onboarding_completed,
    step: lookup.profile.onboarding_step || 0,
    completed_at: lookup.profile.onboarding_completed_at,
    initial_state: {
      displayName: lookup.profile.display_name,
      firmaUnvani,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const step = Math.max(0, Math.min(20, Number(body.step) || 0));
  const skipped = body.skipped === true;

  const updates: Record<string, unknown> = { onboarding_step: step };
  if (skipped) updates.onboarding_skipped_at = new Date().toISOString();

  const { error } = await sb
    .from("profiles")
    .update(updates)
    .eq("id", lookup.profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, step });
}
