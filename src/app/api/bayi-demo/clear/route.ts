/**
 * POST /api/bayi-demo/clear — owner'ın tenant'ından demo veri siler.
 *
 * Güvenlik: sadece DEMO- prefix'li invoice_no'ları + bunlarla bağlı
 * verileri silmek istiyoruz. Manuel girilen veriye dokunma. MVP'de
 * basit yaklaşım: tenant'ta TÜM veriyi siler (demo amaçlı, owner-only).
 *
 * Body: { token, confirm: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { token?: string; confirm?: boolean };
  try {
    body = await req.json() as { token?: string; confirm?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.token || body.confirm !== true) {
    return NextResponse.json({ error: "Token + confirm:true gerekli." }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", body.token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, role")
    .eq("id", magicToken.user_id)
    .maybeSingle();
  if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });
  if (profile.role !== "admin" && profile.role !== "user") {
    return NextResponse.json({ error: "Sadece firma sahibi temizleyebilir." }, { status: 403 });
  }

  // Foreign key cascade için sıralı silme
  const tenantId = profile.tenant_id;
  await supabase.from("bayi_dealer_invoices").delete().eq("tenant_id", tenantId);
  await supabase.from("bayi_dealer_transactions").delete().eq("tenant_id", tenantId);
  await supabase.from("bayi_orders").delete().eq("tenant_id", tenantId);
  await supabase.from("bayi_dealer_visits").delete().eq("tenant_id", tenantId);
  await supabase.from("bayi_dealers").delete().eq("tenant_id", tenantId);
  await supabase.from("bayi_products").delete().eq("tenant_id", tenantId);

  return NextResponse.json({ success: true, cleared: tenantId });
}
