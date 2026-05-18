/**
 * GET /api/bayiler/init — magic-link auth + tenant context.
 *
 * /[locale]/bayiler sayfası mount olduğunda kullanıcı + tenant bilgisi
 * çeker. İki auth modu:
 *   - Token (?t=...) magic-link akışı (eski WA buton URL'leri)
 *   - Cookie session (token yok) — bayipanel/layout.tsx zaten oturum
 *     başlatmış; bayi sidebar'ı token-optional path üretiyor
 *
 * Multi-tenant: profile lookup composite (auth_user_id | id) + bayi
 * tenant_id guard — emlak legacy user bayi'ye girememeli.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";

type BayiProfile = {
  id: string;
  tenant_id: string | null;
  capabilities: string[] | null;
  role: string | null;
  invited_by: string | null;
  display_name: string | null;
  metadata: Record<string, unknown> | null;
  [key: string]: unknown;
};

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  const supabase = getServiceClient();

  let profile: BayiProfile | null = null;

  if (token) {
    // Magic-link akışı
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const bayiCfg = getTenantByKey("bayi");
    if (!bayiCfg?.tenantId) {
      return NextResponse.json({ error: "Bayi tenant config bulunamadı." }, { status: 500 });
    }

    const { data } = await supabase
      .from("profiles")
      .select("id, tenant_id, capabilities, role, invited_by, display_name, metadata")
      .or(`id.eq.${magicToken.user_id},auth_user_id.eq.${magicToken.user_id}`)
      .eq("tenant_id", bayiCfg.tenantId)
      .maybeSingle();
    profile = data as BayiProfile | null;
  } else {
    // Cookie session fallback
    const auth = await resolvePanelAuth(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const lookup = await resolveTenantProfile<BayiProfile>(supabase, {
      userId: auth.userId,
      tenantKey: "bayi",
      select: "id, tenant_id, capabilities, role, invited_by, display_name, metadata",
    });
    if ("error" in lookup) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    }
    profile = lookup.profile;
  }

  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

  const ownerId = profile.invited_by || profile.id;
  const meta = (profile.metadata || {}) as Record<string, unknown>;
  const firmaProfili = (meta.firma_profili as { sektor?: string; ticari_unvan?: string } | undefined);

  return NextResponse.json({
    success: true,
    user: {
      id: profile.id,
      tenantId: profile.tenant_id,
      ownerId,
      displayName: profile.display_name,
      capabilities: profile.capabilities || [],
      sektor: firmaProfili?.sektor || "boya",
      ticariUnvan: firmaProfili?.ticari_unvan || "",
    },
  });
}
