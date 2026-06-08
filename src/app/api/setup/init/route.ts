/**
 * GET /api/setup/init — profil-kurulum form pre-fill.
 *
 * Auth: requireAuth (cookie session öncelikli, ?token=<magic_link> fallback).
 * OTP-first signup'tan sonra URL'de token YOK; cookie session ile çalışır.
 * Eski magic-link akışı (?t=/?token=) backward-compat.
 *
 * NOT: Token kullanılırsa used_at SET edilmez — kullanıcı sayfayı refresh
 * edebilir / geri gelebilir. Used_at /api/profil/save tarafında set edilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const supabase = getServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, whatsapp_phone, metadata, tenant_id, tenants(saas_type)")
      .eq("id", auth.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
    }

    const metadata = (profile.metadata as Record<string, unknown>) ?? {};
    // 2026-06-08: profil-kurulum-mini sayfası response.saas_type'ı bekliyor;
    // null kalırsa "Atla" sonrası panelPathFor(null)=/tr/panel default'a
    // yönlendiriyor ve "Oturum bulunamadı" çıkıyordu. Top-level alan olarak ekle.
    const saasType =
      (profile as { tenants?: { saas_type?: string } | null }).tenants?.saas_type ?? null;
    return NextResponse.json({
      success: true,
      userId: auth.userId,
      saas_type: saasType,
      profile: {
        display_name: profile.display_name || "",
        whatsapp_phone: profile.whatsapp_phone || "",
        office_name: (metadata.office_name as string) || "",
        location: (metadata.location as string) || "",
        email: (metadata.email as string) || "",
        experience_years: (metadata.experience_years as string) || "",
      },
    });
  } catch (err) {
    console.error("[setup:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
