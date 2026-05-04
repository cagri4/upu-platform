/**
 * GET /api/bayiler/init — magic-link auth + tenant context.
 *
 * /[locale]/bayiler sayfası mount olduğunda token doğrulaması + sahip
 * profile'ı çeker. Sayfa bunu state'e koyar, sonraki istekler /list
 * /detail vb endpoint'lere doğrudan gider (token query param ile).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, capabilities, role, invited_by, display_name, metadata")
    .eq("id", magicToken.user_id)
    .single();
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
