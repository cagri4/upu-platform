/**
 * POST /api/auth/switch-tenant
 *
 * Body: { target: "emlak" | "bayi" | "market" | "otel" | "restoran" | "siteyonetim" }
 *
 * Cross-SaaS geçiş: target tenant'ta user'in profile'ı var mı kontrol, varsa
 * o profile için magic_link_token mint (1 saat TTL) + target tenant'ın
 * subdomain + panel path'ine redirect URL döner. Client window.location.replace
 * ile yönlendirir.
 *
 * Response: { redirect: "https://<slug>.upudev.nl/tr/<panel-path>?t=<token>" }
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";

const PANEL_PATH: Record<string, string> = {
  emlak: "/tr/panel",
  bayi: "/tr/bayi-panel",
  market: "/tr/market-panelim",
  otel: "/tr/otel-panel",
  restoran: "/tr/restoran-panel",
  siteyonetim: "/tr/site",
};

export async function POST(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { target?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const target = body.target?.trim();
  if (!target) {
    return NextResponse.json({ error: "target gerekli." }, { status: 400 });
  }

  const tenantCfg = getTenantByKey(target);
  if (!tenantCfg) {
    return NextResponse.json({ error: "Geçersiz tenant key." }, { status: 400 });
  }

  const panelPath = PANEL_PATH[target];
  if (!panelPath) {
    return NextResponse.json(
      { error: `${target} için panel sayfası tanımlı değil.` },
      { status: 400 },
    );
  }

  const sb = getServiceClient();

  // userId → auth_user_id (legacy 1-1 backfill veya multi-tenant ayrı kolon)
  const { data: ownProfile } = await sb
    .from("profiles")
    .select("auth_user_id")
    .eq("id", auth.userId)
    .maybeSingle();

  const authUserId = ownProfile?.auth_user_id || auth.userId;

  // Target tenant profile var mı?
  const { data: targetProfile } = await sb
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("tenant_id", tenantCfg.tenantId)
    .maybeSingle();

  if (!targetProfile) {
    return NextResponse.json(
      { error: `Bu hesap ${tenantCfg.name} için kayıtlı değil.` },
      { status: 404 },
    );
  }

  // Magic link mint (1 saat TTL)
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await sb.from("magic_link_tokens").insert({
    user_id: targetProfile.id,
    token,
    expires_at: expiresAt,
  });

  const redirect = `https://${tenantCfg.slug}.upudev.nl${panelPath}?t=${token}`;
  return NextResponse.json({ redirect });
}
