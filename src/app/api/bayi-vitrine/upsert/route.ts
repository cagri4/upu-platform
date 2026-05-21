/**
 * POST /api/bayi-vitrine/upsert — bayi vitrin konfigürasyonu kaydeder.
 * Body: { token?, slug, title, subtitle?, logo_url?, accent_color?,
 *         is_active?, show_prices?, visible_product_ids? }
 * Slug normalize edilir; çakışmada hata.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const RESERVED = new Set(["api", "v", "admin", "tr", "en", "nl", "bayi", "panel"]);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; role: string | null }>(sb, {
    userId: auth.userId, tenantKey: "bayi", select: "id, tenant_id, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const slugRaw = String(body.slug || "").trim().toLowerCase();
  const slug = slugRaw
    .replace(/[ğ]/g, "g").replace(/[ü]/g, "u").replace(/[ş]/g, "s")
    .replace(/[ı]/g, "i").replace(/[ö]/g, "o").replace(/[ç]/g, "c")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

  if (slug.length < 3) {
    return NextResponse.json({ error: "Geçerli bir slug girin (min 3 karakter)." }, { status: 400 });
  }
  if (RESERVED.has(slug)) {
    return NextResponse.json({ error: "Bu slug rezerve, başka birini seçin." }, { status: 400 });
  }

  // Slug uniqueness check (kendi vitrini hariç)
  const { data: existing } = await sb
    .from("bayi_vitrines")
    .select("id, dealer_user_id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing && existing.dealer_user_id !== lookup.profile.id) {
    return NextResponse.json({ error: "Bu slug başka bir bayide kullanılıyor." }, { status: 409 });
  }

  const payload: Record<string, unknown> = {
    tenant_id: lookup.tenantId,
    dealer_user_id: lookup.profile.id,
    slug,
    title: String(body.title || "").slice(0, 120) || null,
    subtitle: body.subtitle ? String(body.subtitle).slice(0, 200) : null,
    logo_url: body.logo_url ? String(body.logo_url).slice(0, 500) : null,
    accent_color: typeof body.accent_color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(body.accent_color)
      ? body.accent_color
      : "#4f46e5",
    is_active: body.is_active !== false,
    show_prices: body.show_prices !== false,
    visible_product_ids: Array.isArray(body.visible_product_ids)
      ? body.visible_product_ids.slice(0, 200)
      : null,
    updated_at: new Date().toISOString(),
  };

  // Upsert by dealer_user_id (1 vitrine per dealer).
  let result;
  if (existing) {
    result = await sb
      .from("bayi_vitrines")
      .update(payload)
      .eq("id", existing.id)
      .select("id, slug")
      .single();
  } else {
    result = await sb
      .from("bayi_vitrines")
      .insert(payload)
      .select("id, slug")
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, vitrine: result.data });
}
