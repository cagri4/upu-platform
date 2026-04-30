/**
 * GET /api/bayi-calisan-davet/init — validate token and return the
 * list of capabilities the owner can grant. The page renders grouped
 * checkboxes from the labels; the token is not invalidated here so the
 * owner can tweak/resubmit without losing the link.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { BAYI_CAPABILITIES, CAPABILITY_LABELS, DEALER_PRESET, POSITION_PRESETS } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("t");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  // Verify owner — must belong to bayi tenant
  const { data: owner } = await supabase
    .from("profiles")
    .select("display_name, tenant_id, tenants(saas_type)")
    .eq("id", magicToken.user_id)
    .single();

  const saasType = (owner?.tenants as unknown as { saas_type: string } | null)?.saas_type;
  if (saasType !== "bayi") {
    return NextResponse.json({ error: "Bu form yalnızca bayi tenant'ı için." }, { status: 403 });
  }

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
