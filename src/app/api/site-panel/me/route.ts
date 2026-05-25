/**
 * GET /api/site-panel/me — siteyönetim panel cookie session doğrulama.
 *
 * Cookie geçerliyse siteyönetim tenant profili döner. Token gerekmez
 * (sliding session). Pattern bayi-panel/me ile aynı, sadece tenantKey
 * "siteyonetim" ve metadata anahtarları bina-spesifik.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies, attachSessionToResponse } from "@/platform/auth/session";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    const supabase = getServiceClient();
    const lookup = await resolveTenantProfile<{
      display_name: string | null;
      tenant_id: string;
      metadata: Record<string, unknown> | null;
      role: string | null;
    }>(supabase, {
      userId: session.uid,
      tenantKey: "siteyonetim",
      select: "id, display_name, tenant_id, metadata, role",
    });

    if ("error" in lookup) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    }

    // Yöneticinin binası (varsa) — display amaçlı.
    const { data: building } = await supabase
      .from("sy_buildings")
      .select("name")
      .eq("manager_id", lookup.profile.id)
      .eq("tenant_id", lookup.tenantId)
      .limit(1)
      .maybeSingle();

    const response = NextResponse.json({
      success: true,
      displayName: lookup.profile.display_name || null,
      buildingName: building?.name || null,
      officeName: building?.name || null,
      role: lookup.profile.role || "user",
      tenantId: lookup.tenantId,
      botPhone: "31644967207",
    });
    return await attachSessionToResponse(response, {
      uid: session.uid,
      tenantId: lookup.tenantId,
    });
  } catch (err) {
    console.error("[site-panel:me]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
