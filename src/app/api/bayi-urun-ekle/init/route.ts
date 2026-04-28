/**
 * GET /api/bayi-urun-ekle/init — validate token. The form is dead simple
 * (ad / kategori / birim / fiyat / stok / fotolar) so init only confirms
 * the link works and returns existing categories so the dropdown can
 * suggest what the owner already uses.
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
  if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, capabilities, role, invited_by")
    .eq("id", magicToken.user_id)
    .single();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

  const caps = (profile.capabilities as string[] | null) || [];
  const canEdit = caps.includes("*") || caps.includes("products:edit");
  if (!canEdit) return NextResponse.json({ error: "Ürün ekleme yetkiniz yok." }, { status: 403 });

  const ownerId = profile.invited_by || profile.id;

  const { data: existing } = await supabase
    .from("bayi_products")
    .select("category")
    .eq("user_id", ownerId)
    .not("category", "is", null)
    .limit(50);
  const categories = Array.from(new Set((existing || []).map((p) => p.category).filter(Boolean))) as string[];

  return NextResponse.json({ success: true, categories });
}
