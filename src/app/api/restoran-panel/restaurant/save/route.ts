/**
 * POST /api/restoran-panel/restaurant/save
 *
 * Restoran sahibi public kart ayarlarını günceller — Sprint 3 D8 minimal admin UI.
 *
 * Güncellenebilir alanlar (whitelist):
 *   - menu_greeting (samimi karşılama, Butlaroo paterni)
 *   - enabled_languages (text[], ['tr','nl','en','fr','de','it'])
 *   - default_language (text, enabled_languages içinde olmalı)
 *   - tagline (string)
 *   - primary_color / secondary_color (hex)
 *   - accepts_online_payment / accepts_cash_on_delivery / accepts_dine_in (bool)
 *
 * Slug DOKUNULMAZ (SEO + müşteri link kırılma riski).
 * is_published da panel'den toggle edilmez — şimdilik admin onayıyla (V2).
 *
 * Auth: magic token, tenant_id eşleşmesi.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

const VALID_LANGS = new Set(["tr", "nl", "en", "fr", "de", "it"]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

interface Body {
  token?: string;
  menu_greeting?: string | null;
  enabled_languages?: string[];
  default_language?: string;
  tagline?: string | null;
  primary_color?: string;
  secondary_color?: string;
  accepts_online_payment?: boolean;
  accepts_cash_on_delivery?: boolean;
  accepts_dine_in?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const token = body.token || req.nextUrl.searchParams.get("t");
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

    const sb = getServiceClient();
    const { data: magicToken } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("tenant_id")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    const { data: restaurant } = await sb
      .from("rst_restaurants")
      .select("id")
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!restaurant) return NextResponse.json({ error: "Restoran kartı yok." }, { status: 404 });

    // Whitelist update
    const updates: Record<string, unknown> = {};

    if (body.menu_greeting !== undefined) {
      const text = body.menu_greeting ? String(body.menu_greeting).trim().substring(0, 200) : null;
      updates.menu_greeting = text;
    }

    if (Array.isArray(body.enabled_languages)) {
      const langs = body.enabled_languages.filter((l) => VALID_LANGS.has(String(l)));
      if (langs.length === 0) {
        return NextResponse.json({ error: "En az 1 dil seçin." }, { status: 400 });
      }
      updates.enabled_languages = langs;
    }

    if (body.default_language !== undefined) {
      if (!VALID_LANGS.has(body.default_language)) {
        return NextResponse.json({ error: "Geçersiz default dil." }, { status: 400 });
      }
      const langs = Array.isArray(body.enabled_languages)
        ? body.enabled_languages
        : null;
      if (langs && !langs.includes(body.default_language)) {
        return NextResponse.json(
          { error: "Default dil enabled_languages içinde olmalı." },
          { status: 400 },
        );
      }
      updates.default_language = body.default_language;
    }

    if (body.tagline !== undefined) {
      updates.tagline = body.tagline ? String(body.tagline).trim().substring(0, 200) : null;
    }

    if (body.primary_color !== undefined) {
      if (!HEX_COLOR.test(body.primary_color)) {
        return NextResponse.json({ error: "Renk #RRGGBB hex olmalı." }, { status: 400 });
      }
      updates.primary_color = body.primary_color;
    }
    if (body.secondary_color !== undefined) {
      if (!HEX_COLOR.test(body.secondary_color)) {
        return NextResponse.json({ error: "Renk #RRGGBB hex olmalı." }, { status: 400 });
      }
      updates.secondary_color = body.secondary_color;
    }

    if (typeof body.accepts_online_payment === "boolean") {
      updates.accepts_online_payment = body.accepts_online_payment;
    }
    if (typeof body.accepts_cash_on_delivery === "boolean") {
      updates.accepts_cash_on_delivery = body.accepts_cash_on_delivery;
    }
    if (typeof body.accepts_dine_in === "boolean") {
      updates.accepts_dine_in = body.accepts_dine_in;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
    }

    await sb.from("rst_restaurants").update(updates).eq("id", restaurant.id);

    return NextResponse.json({ ok: true, updates });
  } catch (err) {
    console.error("[restoran-panel/restaurant/save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
