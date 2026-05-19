/**
 * GET  /api/bayi-davet/slug — dağıtıcının statik davet slug'ı.
 *
 * Dağıtıcı paneli "Bayi Davet" sayfasında çağrılır. Slug yoksa firma
 * ünvanından (veya display_name'den) kebab-case üretilir, çakışma varsa
 * -2/-3 suffix ile UNIQUE kayıt yapılır. Slug evergreen — bir kere
 * üretilince değişmez (paylaşılan link'ler kırılmasın).
 *
 * Auth: subdomain bayi + cookie session (resolvePanelAuth).
 * Multi-tenant aware: resolveTenantProfile composite lookup.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

const TR_MAP: Record<string, string> = {
  ş: "s", Ş: "s",
  ı: "i", İ: "i", I: "i",
  ç: "c", Ç: "c",
  ğ: "g", Ğ: "g",
  ü: "u", Ü: "u",
  ö: "o", Ö: "o",
};

function slugify(raw: string): string {
  return raw
    .replace(/[şŞıIİçÇğĞüÜöÖ]/g, (c) => TR_MAP[c] || c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "bayi";
}

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  if (hostTenant?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde kullanılır." }, { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null;
    metadata: Record<string, unknown> | null;
    role: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, display_name, metadata, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const distributorProfileId = lookup.profile.id;
  const tenantId = lookup.tenantId;

  // Mevcut slug var mı?
  const { data: existing } = await sb
    .from("distributor_slugs")
    .select("slug, display_name")
    .eq("distributor_user_id", distributorProfileId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      slug: existing.slug,
      display_name: existing.display_name,
    });
  }

  // Slug üret: firma ticari_unvan → display_name fallback
  const meta = (lookup.profile.metadata as Record<string, unknown>) || {};
  const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
  const source = firma?.ticari_unvan || lookup.profile.display_name || "bayi";
  let base = slugify(source);

  // Çakışma kontrolü — -2, -3, ... suffix
  let slug = base;
  for (let i = 2; i <= 99; i++) {
    const { data: taken } = await sb
      .from("distributor_slugs")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  const { error: insertErr } = await sb
    .from("distributor_slugs")
    .insert({
      slug,
      distributor_user_id: distributorProfileId,
      tenant_id: tenantId,
      display_name: source,
    });
  if (insertErr) {
    console.error("[bayi-davet/slug] insert error:", insertErr);
    return NextResponse.json({ error: "Slug oluşturulamadı." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, slug, display_name: source });
}
