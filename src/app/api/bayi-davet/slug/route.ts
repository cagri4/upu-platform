/**
 * GET /api/bayi-davet/slug — dağıtıcının statik davet slug'ı (tenant + dağıtıcı).
 *
 * Yeni format: /davet/<tenant_slug>/<slug>
 *   - tenant_slug: firma ticari_unvan'dan slugify (örn "karsel"). Aynı
 *     tenant'taki tüm dağıtıcılar paylaşır (firma seviyesi namespace).
 *   - slug: dağıtıcı display_name'den slugify (örn "cagr"). (tenant_slug,
 *     slug) composite unique — farklı firmalar aynı dağıtıcı slug
 *     kullanabilir.
 *
 * Slug evergreen — bir kere üretilince değişmez (paylaşılan link'ler
 * kırılmasın).
 *
 * Auth: subdomain bayi + cookie session.
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

function slugify(raw: string, fallback = "bayi"): string {
  return (
    raw
      .replace(/[şŞıIİçÇğĞüÜöÖ]/g, (c) => TR_MAP[c] || c)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || fallback
  );
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

  // Mevcut kayıt var mı (bu admin için)?
  const { data: existing } = await sb
    .from("distributor_slugs")
    .select("slug, tenant_slug, display_name")
    .eq("distributor_user_id", distributorProfileId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      tenant_slug: existing.tenant_slug,
      slug: existing.slug,
      display_name: existing.display_name,
    });
  }

  // Tenant slug: bu tenant_id için zaten kayıt var mı (başka bir admin)?
  // Varsa aynı tenant_slug kullan; yoksa yeni üret + global çakışma kontrolü.
  const { data: tenantPeer } = await sb
    .from("distributor_slugs")
    .select("tenant_slug")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  let tenantSlug: string;
  if (tenantPeer?.tenant_slug) {
    tenantSlug = tenantPeer.tenant_slug;
  } else {
    const meta = (lookup.profile.metadata as Record<string, unknown>) || {};
    const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
    const tenantSource = firma?.ticari_unvan || "bayi";
    const tenantBase = slugify(tenantSource, "bayi");
    tenantSlug = tenantBase;
    // Global tenant_slug uniqueness (her firmanın kendi namespace'i)
    for (let i = 2; i <= 99; i++) {
      const { data: taken } = await sb
        .from("distributor_slugs")
        .select("tenant_slug")
        .eq("tenant_slug", tenantSlug)
        .neq("tenant_id", tenantId)
        .limit(1)
        .maybeSingle();
      if (!taken) break;
      tenantSlug = `${tenantBase}-${i}`;
    }
  }

  // Dağıtıcı slug: display_name'den; (tenant_slug, slug) composite UNIQUE
  const distName = lookup.profile.display_name || "bayi";
  const distBase = slugify(distName, "bayi");
  let slug = distBase;
  for (let i = 2; i <= 99; i++) {
    const { data: taken } = await sb
      .from("distributor_slugs")
      .select("slug")
      .eq("tenant_slug", tenantSlug)
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${distBase}-${i}`;
  }

  const displaySource =
    ((lookup.profile.metadata as Record<string, unknown>)?.firma_profili as { ticari_unvan?: string } | null)?.ticari_unvan ||
    lookup.profile.display_name ||
    "Dağıtıcınız";

  const { error: insertErr } = await sb
    .from("distributor_slugs")
    .insert({
      tenant_slug: tenantSlug,
      slug,
      distributor_user_id: distributorProfileId,
      tenant_id: tenantId,
      display_name: displaySource,
    });
  if (insertErr) {
    console.error("[bayi-davet/slug] insert error:", insertErr);
    return NextResponse.json({ error: "Slug oluşturulamadı." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    tenant_slug: tenantSlug,
    slug,
    display_name: displaySource,
  });
}
