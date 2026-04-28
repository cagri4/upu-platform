/**
 * POST /api/bayi-urun-ekle/save — insert into bayi_products. Triggers
 * discovery chain step 2 (urun_eklendi) which fires the next prompt
 * ("Bayi Davet Linki" button) on WhatsApp.
 *
 * Body: {
 *   token,
 *   name, unit, unit_price,                       // zorunlu
 *   code?, category?, stock_quantity?, low_stock_threshold?,
 *   min_order?, description?, image_url?, images?, brand?
 * }
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID_UNITS = new Set(["adet", "kg", "lt", "m2", "m", "kutu", "koli", "palet", "paket"]);

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function slugifyCode(input: string): string {
  return input
    .toLocaleUpperCase("tr-TR")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 32);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = s(body.token);
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

    const name = s(body.name);
    const unit = s(body.unit) || "adet";
    const unitPrice = num(body.unit_price);

    if (name.length < 2) return NextResponse.json({ error: "Ürün adı en az 2 karakter olmalı." }, { status: 400 });
    if (unitPrice === null || unitPrice <= 0) return NextResponse.json({ error: "Geçerli birim fiyat girin." }, { status: 400 });
    if (!VALID_UNITS.has(unit)) return NextResponse.json({ error: "Geçersiz birim." }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id, capabilities, role, invited_by, whatsapp_phone")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const caps = (profile.capabilities as string[] | null) || [];
    const canEdit = caps.includes("*") || caps.includes("products:edit");
    if (!canEdit) return NextResponse.json({ error: "Ürün ekleme yetkiniz yok." }, { status: 403 });

    const ownerId = profile.invited_by || profile.id;

    const code = s(body.code) || slugifyCode(name);
    const category = s(body.category) || null;
    const stockQty = num(body.stock_quantity);
    const lowStock = num(body.low_stock_threshold);
    const minOrder = num(body.min_order);
    const description = s(body.description) || null;
    const imageUrl = s(body.image_url) || null;
    const brand = s(body.brand) || null;
    const imagesRaw = Array.isArray(body.images) ? body.images : [];
    const images: string[] = imagesRaw
      .filter((u: unknown): u is string => typeof u === "string" && u.startsWith("http"))
      .slice(0, 5);

    const { data: inserted, error } = await supabase
      .from("bayi_products")
      .insert({
        tenant_id: profile.tenant_id,
        user_id: ownerId,
        name,
        code,
        category,
        unit,
        unit_price: unitPrice,
        base_price: unitPrice,
        stock_quantity: stockQty ?? 0,
        low_stock_threshold: lowStock ?? null,
        min_order: minOrder ?? 1,
        description,
        image_url: imageUrl || (images[0] || null),
        images: images.length > 0 ? images : [],
        brand,
        is_active: true,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("[bayi-urun-ekle:save]", error);
      return NextResponse.json({ error: error?.message || "Kaydedilemedi." }, { status: 500 });
    }

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    const userId = profile.id;
    const userPhone = profile.whatsapp_phone as string | undefined;

    after(async () => {
      try {
        if (!userPhone) return;
        const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
        await advanceDiscovery(userId, "bayi", userPhone, "urun_eklendi");
      } catch (err) {
        console.error("[bayi-urun-ekle:save] WA chain failed:", err);
      }
    });

    return NextResponse.json({ success: true, productId: inserted.id });
  } catch (err) {
    console.error("[bayi-urun-ekle:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
