/**
 * Setup save: accept token + form data, update profile, complete onboarding,
 * invalidate token, trigger WhatsApp bot welcome message.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

interface SetupPayload {
  token: string;
  display_name: string;
  office_name: string;
  location: string;
  email: string;
  experience_years: string;
  briefing_enabled: boolean;
  // Search criteria
  region: string;
  property_type: string;
  listing_type: string;
  listed_by: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SetupPayload;
    if (!body.token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();

    // Verify + consume token
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", body.token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });

    // Basic validation
    if (!body.display_name?.trim() || body.display_name.length < 2) {
      return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });
    }

    // Fetch current user (for WA phone)
    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_phone, tenant_id, metadata")
      .eq("id", magicToken.user_id)
      .single();

    const userPhone = profile?.whatsapp_phone as string | undefined;
    const tenantId = profile?.tenant_id as string | undefined;
    if (!userPhone || !tenantId) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    // Update profile
    const newMetadata = {
      ...(profile?.metadata as Record<string, unknown> || {}),
      office_name: body.office_name?.trim() || null,
      location: body.location?.trim() || null,
      email: body.email?.trim() || null,
      experience_years: body.experience_years?.trim() || null,
      briefing_enabled: !!body.briefing_enabled,
      onboarding_completed: true,
      discovery_step: 0,
      search_criteria: {
        region: body.region,
        property_type: body.property_type,
        listing_type: body.listing_type,
        listed_by: body.listed_by,
      },
    };

    await supabase.from("profiles").update({
      display_name: body.display_name.trim(),
      metadata: newMetadata,
    }).eq("id", magicToken.user_id);

    // Mark onboarding_state complete
    await supabase.from("onboarding_state").upsert({
      user_id: magicToken.user_id,
      tenant_key: "emlak",
      current_step: "done",
      business_info: {
        office_name: body.office_name,
        location: body.location,
        email: body.email,
        experience_years: body.experience_years,
        briefing_enabled: body.briefing_enabled,
      },
      completed_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    // Invalidate token
    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    // Trigger welcome message on WhatsApp
    try {
      const firstName = body.display_name.trim().split(/\s+/)[0];
      await sendButtons(userPhone,
        `🎉 Hoşgeldin ${firstName}!\n\nProfilin hazır. Şimdi ilk mülkünü ekleyip satışları artıralım.`,
        [{ id: "cmd:mulkekle", title: "🏠 Mülk Ekle" }],
      );
    } catch (waErr) {
      console.error("[setup:save] WA notify failed:", waErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[setup:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
