/**
 * POST /api/bayi-onboarding/profile — Step2 profile (sector + dealer_range).
 * Mevcut metadata.firma_profili'ne ekler, tablo seviyesi role/email değiştirmez.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const SECTORS = new Set(["tekstil", "gida", "kozmetik", "insaat", "elektronik", "diger"]);
const RANGES = new Set(["1-5", "6-20", "21-50", "50+"]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string;
    tenant_id: string;
    metadata: Record<string, unknown> | null;
  }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const firma = String(body.firma_unvani || "").trim().slice(0, 200);
  const sector = String(body.sector || "").trim();
  const range = String(body.dealer_range || "").trim();

  const meta = (lookup.profile.metadata || {}) as Record<string, unknown>;
  const firmaProfili = (meta.firma_profili || {}) as Record<string, unknown>;

  if (firma) firmaProfili.ticari_unvan = firma;
  if (sector && SECTORS.has(sector)) firmaProfili.sector = sector;
  if (range && RANGES.has(range)) firmaProfili.dealer_range = range;

  const newMeta = { ...meta, firma_profili: firmaProfili };

  const { error } = await sb
    .from("profiles")
    .update({ metadata: newMeta })
    .eq("id", lookup.profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
