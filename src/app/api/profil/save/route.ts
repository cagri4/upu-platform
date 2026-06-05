/**
 * /api/profil/save — Profile-only save. Completes onboarding, sends WA welcome message.
 *
 * Multi-tenant izolasyon (2026-06-05): bu endpoint emlak signup'ı için
 * tasarlandı. Bayi/restoran/market/otel/site/muhasebe profil sayfaları
 * KENDI save endpoint'lerini kullanır. Bu endpoint:
 *   - emlak profili → mevcut akış (office_name/location/experience_years
 *     kaydedilir, emlak menu gönderilir)
 *   - non-emlak profili → emlak-spesifik alanları YOK SAY, emlak menu
 *     gönderme, sadece display_name/email/briefing_enabled kaydet.
 * Bu sayede mini sayfa aynı endpoint'i güvenle çağırabilir; veri sızıntısı
 * önlenir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string | undefined;

    // Cookie session öncelik, legacy magic-link token fallback.
    // Onboarding linki için used_at one-time semantik token path'inde korunur.
    const supabase = getServiceClient();
    let userId: string | null = null;
    let magicTokenId: string | null = null;
    const session = await getSessionFromCookies();
    if (session?.uid) {
      userId = session.uid;
    } else if (token) {
      const { data: magicToken } = await supabase
        .from("magic_link_tokens")
        .select("id, user_id, expires_at, used_at")
        .eq("token", token).maybeSingle();
      if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
      if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
      if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
      userId = magicToken.user_id;
      magicTokenId = magicToken.id;
    }
    if (!userId) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

    if (!body.display_name?.trim() || body.display_name.length < 2) {
      return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_phone, tenant_id, metadata")
      .eq("id", userId).single();
    const userPhone = profile?.whatsapp_phone as string | undefined;
    if (!userPhone) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    // Tenant tipini çöz — emlak'a sızıntı önleme guard'ı.
    let saasType: string | null = null;
    if (profile?.tenant_id) {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("saas_type")
        .eq("id", profile.tenant_id)
        .maybeSingle();
      saasType = (tenantRow?.saas_type as string | null) ?? null;
    }
    const isEmlak = saasType === "emlak";

    // Emlak-spesifik alanlar yalnızca emlak için kabul edilir; diğer
    // SaaS'larda body içinde gelse bile metadata'ya yazılmaz.
    const baseMetadata = (profile?.metadata as Record<string, unknown>) || {};
    const newMetadata: Record<string, unknown> = {
      ...baseMetadata,
      email: body.email?.trim() || baseMetadata.email || null,
      briefing_enabled: !!body.briefing_enabled,
      onboarding_completed: true,
      discovery_step: 0,
    };
    if (isEmlak) {
      newMetadata.office_name = body.office_name?.trim() || null;
      newMetadata.location = body.location?.trim() || null;
      newMetadata.experience_years = body.experience_years?.trim() || null;
    } else if (
      body.office_name || body.location || body.experience_years
    ) {
      console.warn(
        `[profil:save] non-emlak (${saasType}) tenant'tan emlak-spesifik field geldi, yoksayıldı`,
        { userId, tenantId: profile?.tenant_id },
      );
    }

    await supabase.from("profiles").update({
      display_name: body.display_name.trim(),
      metadata: newMetadata,
    }).eq("id", userId);

    // onboarding_state — tenant_key dinamik (eski 'emlak' hardcode'u kaldırıldı).
    const onboardingTenantKey = saasType ?? "emlak";
    const businessInfo: Record<string, unknown> = {
      email: body.email || null,
      briefing_enabled: body.briefing_enabled,
    };
    if (isEmlak) {
      businessInfo.office_name = body.office_name;
      businessInfo.location = body.location;
      businessInfo.experience_years = body.experience_years;
    }
    await supabase.from("onboarding_state").upsert({
      user_id: userId,
      tenant_key: onboardingTenantKey,
      current_step: "done",
      business_info: businessInfo,
      completed_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (magicTokenId) {
      await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicTokenId);
    }

    // Emlak menu yalnızca emlak için gönderilir; diğer SaaS'lar mini sayfa
    // sonrası kendi panel'lerine yönlenir.
    if (isEmlak) {
      try {
        const { sendEmlakMenu } = await import("@/tenants/emlak/menu");
        await sendEmlakMenu(
          { userId: userId, phone: userPhone, userName: body.display_name },
          true,
        );
      } catch (err) {
        console.error("[profil:save] WA notify failed:", err);
      }
    }

    return NextResponse.json({ success: true, saas_type: saasType });
  } catch (err) {
    console.error("[profil:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
