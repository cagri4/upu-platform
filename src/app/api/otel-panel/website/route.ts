/**
 * /api/otel-panel/website — Otel public web sayfası ayarları (Faz 2)
 *
 * GET: mevcut slug + public_settings + web_published
 * PATCH body: { slug?, web_published?, hero_title?, hero_subtitle?, description?,
 *               gallery_urls?, amenities?, contact?, address? }
 *
 * Tüm public_settings alanları "merge" — sadece gelenler yazılır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth, requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function getOwnerHotel(sb: any, userId: string) {
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return { error: lookup.error, status: lookup.status };

  const { data: ouh } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .limit(1)
    .maybeSingle();
  if (!ouh?.hotel_id) return { error: "Otel atanmamış", status: 403 };

  return { hotelId: ouh.hotel_id };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const res = await getOwnerHotel(sb, auth.userId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });

  const { data: hotel } = await sb
    .from("otel_hotels")
    .select("id, name, slug, public_settings, web_published")
    .eq("id", res.hotelId)
    .single();

  return NextResponse.json({
    success: true,
    hotel: hotel || null,
  });
}

interface PatchBody {
  slug?: string;
  web_published?: boolean;
  hero_title?: string;
  hero_subtitle?: string;
  description?: string;
  address?: string;
  gallery_urls?: string[];
  amenities?: string[];
  contact?: { phone?: string; email?: string };
  policies?: Record<string, any>;
  token?: string | null;
}

export async function PATCH(req: NextRequest) {
  const body: PatchBody = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const res = await getOwnerHotel(sb, auth.userId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });

  const updates: Record<string, any> = {};

  if (body.slug !== undefined) {
    const s = body.slug.toLowerCase().trim();
    if (s && !SLUG_RE.test(s)) {
      return NextResponse.json({ error: "Slug sadece küçük harf/rakam/tire içerebilir" }, { status: 400 });
    }
    if (s) {
      // Slug çakışma check
      const { data: existing } = await sb
        .from("otel_hotels")
        .select("id")
        .eq("slug", s)
        .neq("id", res.hotelId)
        .maybeSingle();
      if (existing) return NextResponse.json({ error: "Bu slug başka bir otel tarafından kullanılıyor" }, { status: 409 });
    }
    updates.slug = s || null;
  }
  if (body.web_published !== undefined) {
    if (body.web_published === true) {
      // Yayına almak için slug zorunlu
      const { data: h } = await sb.from("otel_hotels").select("slug").eq("id", res.hotelId).single();
      const slug = updates.slug !== undefined ? updates.slug : h?.slug;
      if (!slug) return NextResponse.json({ error: "Yayına almadan önce slug belirleyin" }, { status: 400 });
    }
    updates.web_published = body.web_published;
  }

  // public_settings merge
  const settingsFields = ["hero_title", "hero_subtitle", "description", "address", "gallery_urls", "amenities", "contact", "policies"] as const;
  const newSettings: Record<string, any> = {};
  let hasSettings = false;
  for (const f of settingsFields) {
    if ((body as any)[f] !== undefined) {
      newSettings[f] = (body as any)[f];
      hasSettings = true;
    }
  }
  if (hasSettings) {
    const { data: current } = await sb
      .from("otel_hotels")
      .select("public_settings")
      .eq("id", res.hotelId)
      .single();
    const merged = { ...(current?.public_settings || {}), ...newSettings };
    updates.public_settings = merged;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });
  }

  const { data: updated, error } = await sb
    .from("otel_hotels")
    .update(updates)
    .eq("id", res.hotelId)
    .select("id, name, slug, public_settings, web_published")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({ success: true, hotel: updated });
}
