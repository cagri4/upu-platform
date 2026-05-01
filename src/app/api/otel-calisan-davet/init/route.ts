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
import {
  CAPABILITY_LABELS,
  ROLE_PRESETS,
  FORM_VISIBLE_CAPABILITIES,
} from "@/tenants/otel/capabilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("t");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at, purpose")
    .eq("token", token)
    .maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }
  if (magicToken.purpose && magicToken.purpose !== "otel-calisan-davet") {
    return NextResponse.json({ error: "Bu link otel çalışan daveti için değil." }, { status: 400 });
  }

  // Verify owner — must belong to otel tenant
  const { data: owner } = await supabase
    .from("profiles")
    .select("display_name, tenant_id, tenants(saas_type)")
    .eq("id", magicToken.user_id)
    .single();

  const saasType = (owner?.tenants as unknown as { saas_type: string } | null)?.saas_type;
  if (saasType !== "otel") {
    return NextResponse.json({ error: "Bu form yalnızca otel tenant'ı için." }, { status: 403 });
  }

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

  // Owner'ın bağlı otelleri (multi-property dropdown için — column: user_id)
  const { data: hotels } = await supabase
    .from("otel_user_hotels")
    .select("hotel_id, otel_hotels(id, name, location)")
    .eq("user_id", magicToken.user_id);

  const hotelOptions = (hotels || []).map((row: any) => ({
    id: row.hotel_id,
    name: row.otel_hotels?.name || "Otel",
    location: row.otel_hotels?.location || "",
  })).filter((h: any) => h.id);

  return NextResponse.json({
    success: true,
    ownerName: owner?.display_name || "",
    groups,
    positions,
    hotels: hotelOptions,
  });
}
