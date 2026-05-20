/**
 * GET /api/otel-calisan-davet/init — token doğrula, otel sahibinin
 * verebileceği capability listesi + role preset listesi + bağlı oteller
 * dropdown'u için döndür.
 *
 * Token tek-kullanımlık değil (owner formu submit edene kadar açık kalır,
 * 2h TTL). save endpoint'inde used_at işaretlenir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import {
  CAPABILITY_LABELS,
  ROLE_PRESETS,
  FORM_VISIBLE_CAPABILITIES,
} from "@/tenants/otel/capabilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const supabase = getServiceClient();
  const lookup = await resolveTenantProfile<{
    id: string; display_name: string | null; tenant_id: string;
  }>(supabase, {
    userId: auth.userId,
    tenantKey: "otel",
    select: "id, display_name, tenant_id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
  const owner = lookup.profile;

  // Capability gruplarını oluştur — sadece form'a görünenler (F&B + misafir-tarafı gizli)
  const visible = new Set<string>(FORM_VISIBLE_CAPABILITIES);
  const groups: Record<string, { id: string; label: string }[]> = {};
  for (const [key, meta] of Object.entries(CAPABILITY_LABELS)) {
    if (!visible.has(key)) continue;
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push({ id: key, label: meta.label });
  }

  // Role presetler — preset dropdown
  const positions = Object.entries(ROLE_PRESETS).map(([key, value]) => ({
    id: key,
    label: value.label,
    capabilities: [...value.caps],
  }));

  // Owner'ın bağlı otelleri (multi-property dropdown için — otel_hotels gerçek
  // şema: name, address, city, country)
  const { data: hotels } = await supabase
    .from("otel_user_hotels")
    .select("hotel_id, otel_hotels(id, name, city, address)")
    .eq("user_id", owner.id);

  const hotelOptions = (hotels || []).map((row: any) => ({
    id: row.hotel_id,
    name: row.otel_hotels?.name || "Otel",
    location: row.otel_hotels?.city || row.otel_hotels?.address || "",
  })).filter((h: any) => h.id);

  return NextResponse.json({
    success: true,
    ownerName: owner?.display_name || "",
    groups,
    positions,
    hotels: hotelOptions,
  });
}
