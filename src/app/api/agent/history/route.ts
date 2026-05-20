/**
 * GET /api/agent/history — Son N mesaj (default 50).
 *
 * Response: { messages: [{ role, content, tool_use_id, created_at }, ...] }
 * Sıra: eskiden yeniye (UI direkt render edebilsin).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

const SUPPORTED_TENANTS = new Set(["bayi", "emlak"]);

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenantKey = getTenantByDomain(host)?.key || null;
  if (!tenantKey || !SUPPORTED_TENANTS.has(tenantKey)) {
    return NextResponse.json(
      { error: `UPU agent bu domain'de aktif değil (tenant: ${tenantKey || "unknown"}).` },
      { status: 403 },
    );
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ display_name: string | null }>(sb, {
    userId: auth.userId,
    tenantKey,
    select: "id, display_name",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const limit = Math.min(100, Number(req.nextUrl.searchParams.get("limit")) || 50);

  const { data, error } = await sb
    .from("agent_conversations")
    .select("id, role, content, tool_use_id, created_at")
    .eq("user_id", lookup.profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: "History alınamadı." }, { status: 500 });

  return NextResponse.json({
    ok: true,
    display_name: lookup.profile.display_name,
    messages: (data || []).reverse(),
  });
}
