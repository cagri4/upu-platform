/**
 * Setup save: accept token + form data, update profile, complete onboarding,
 * invalidate token, trigger WhatsApp bot welcome message.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { sendButtons } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

interface SetupPayload {
  token?: string;
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
    const auth = await requireAuthFromBody(req, body);
    if ("error" in auth) return auth.error;

    const supabase = getServiceClient();

    // Basic validation
    if (!body.display_name?.trim() || body.display_name.length < 2) {
      return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });
    }

    // Fetch current user (for WA phone)
    const lookup = await resolveTenantProfile<{
      id: string; whatsapp_phone: string | null; tenant_id: string;
      metadata: Record<string, unknown> | null;
    }>(supabase, {
      userId: auth.userId,
      tenantKey: "emlak",
      select: "id, whatsapp_phone, tenant_id, metadata",
    });
    if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    const profile = lookup.profile;

    const userPhone = profile.whatsapp_phone || undefined;
    const tenantId = profile.tenant_id;
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
    }).eq("id", profile.id);

    // Mark onboarding_state complete
    await supabase.from("onboarding_state").upsert({
      user_id: profile.id,
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

    // Invalidate magic token (sadece magic-link akışından geldiyse)
    if (auth.magicTokenId) {
      await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", auth.magicTokenId);
    }

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
