/**
 * /api/profil/save — Profile-only save. Completes onboarding, sends WA welcome message.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token).maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });

    if (!body.display_name?.trim() || body.display_name.length < 2) {
      return NextResponse.json({ error: "Ad soyad gerekli." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_phone, tenant_id, metadata")
      .eq("id", magicToken.user_id).single();
    const userPhone = profile?.whatsapp_phone as string | undefined;
    if (!userPhone) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const newMetadata = {
      ...(profile?.metadata as Record<string, unknown> || {}),
      office_name: body.office_name?.trim() || null,
      location: body.location?.trim() || null,
      email: body.email?.trim() || null,
      experience_years: body.experience_years?.trim() || null,
      briefing_enabled: !!body.briefing_enabled,
      onboarding_completed: true,
      discovery_step: 0,
    };

    await supabase.from("profiles").update({
      display_name: body.display_name.trim(),
      metadata: newMetadata,
    }).eq("id", magicToken.user_id);

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

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    try {
      const firstName = body.display_name.trim().split(/\s+/)[0];
      await sendButtons(userPhone,
        `🎉 Hoşgeldin ${firstName}!\n\nProfilin hazır. Şimdi ilk mülkünü ekleyip satışları artıralım.`,
        [{ id: "cmd:mulkekle", title: "🏠 Mülk Ekle" }],
        { skipNav: true },
      );
    } catch (err) {
      console.error("[profil:save] WA notify failed:", err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[profil:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
