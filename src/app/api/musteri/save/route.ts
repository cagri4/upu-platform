/**
 * /api/musteri/save — yeni müşteri kaydı (eşleştirme YOK).
 * Kayıt sonrası WA'ya "✅ Müşteri kaydedildi" mesajı + sonraki flow
 * (Profil Düzenle) magic link butonu after() içinde gönderilir.
 *
 * POST { token, name, phone, email?, listing_type, property_type[], rooms?,
 *        budget_min?, budget_max?, location?, notes? }
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton, sendText } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const name = String(body.name || "").trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "İsim en az 2 karakter olmalı." }, { status: 400 });
    }

    const phone = String(body.phone || "").trim();
    if (phone.length < 7) {
      return NextResponse.json({ error: "Geçerli telefon gerekli." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, whatsapp_phone")
      .eq("id", magicToken.user_id)
      .single();
    const tenantId = profile?.tenant_id as string | undefined;
    if (!tenantId) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const propertyType = Array.isArray(body.property_type) ? body.property_type : [];

    const { data: inserted, error } = await supabase
      .from("emlak_customers")
      .insert({
        tenant_id: tenantId,
        user_id: magicToken.user_id,
        name,
        phone,
        email: body.email ? String(body.email).trim() : null,
        listing_type: body.listing_type || null,
        property_type: propertyType.length > 0 ? propertyType : null,
        rooms: body.rooms || null,
        budget_min: body.budget_min ? Number(body.budget_min) : null,
        budget_max: body.budget_max ? Number(body.budget_max) : null,
        location: body.location || null,
        notes: body.notes || null,
        status: "aktif",
        pipeline_stage: "yeni",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("[musteri:save]", error);
      return NextResponse.json({ error: error?.message || "Kaydedilemedi." }, { status: 500 });
    }

    const userPhone = profile?.whatsapp_phone as string | undefined;

    // WA bildirimi + Sonraki flow (Profil Düzenle) — after() içinde
    after(async () => {
      try {
        if (!userPhone) return;
        const sb = getServiceClient();

        await sendText(
          userPhone,
          `✅ *Müşteri kaydedildi!*\n\n👤 ${name}\n📞 ${phone}\n\nMüşteri profili sisteme eklendi. İleride menüden *🤝 Müşteri Ekle* veya *Müşteriler* ile yenisi ekleyip listeyi yönetebilirsin.`,
        );

        // Sonraki flow: Profil Düzenle
        const profilToken = randomBytes(16).toString("hex");
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await sb.from("magic_link_tokens").insert({
          user_id: magicToken.user_id,
          token: profilToken,
          expires_at: expires,
        });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
        const profilUrl = `${appUrl}/tr/profil-duzenle?t=${profilToken}`;

        await sendUrlButton(
          userPhone,
          `🪪 *Şimdi profilinizi tamamlayalım.*\n\nVerdiğiniz bilgiler birazdan oluşturacağımız *kişisel web sayfanızda* kullanılacak. Aşağıdaki forma adres, sektör tecrübeniz, profil fotoğrafı gibi bilgileri ekleyin.`,
          "🪪 Profili Düzenle",
          profilUrl,
          { skipNav: true },
        );
      } catch (err) {
        console.error("[musteri:save] WA notify failed:", err);
      }
    });

    return NextResponse.json({ success: true, customerId: inserted.id });
  } catch (err) {
    console.error("[musteri:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
