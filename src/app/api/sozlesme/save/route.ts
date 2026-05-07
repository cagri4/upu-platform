/**
 * /api/sozlesme/save — panel-içi sözleşme oluşturma.
 * POST { token, property_id, customer_id, commission, duration, exclusive }
 * → contracts tablosuna kayıt + sign_token + WA bildirim.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, property_id, customer_id, commission, duration, exclusive } = body || {};

    if (!token || !property_id || !customer_id) {
      return NextResponse.json({ error: "Mülk ve müşteri seçimi zorunlu." }, { status: 400 });
    }

    const sb = getServiceClient();
    const { data: pt } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
    if (new Date(pt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
    }

    // Mülk + müşteri çek (kullanıcıya ait olduğunu doğrula)
    const [propRes, custRes, profileRes] = await Promise.all([
      sb.from("emlak_properties")
        .select("id, title, listing_type, type, price, location_city, location_district, location_neighborhood")
        .eq("id", property_id).eq("user_id", pt.user_id).maybeSingle(),
      sb.from("emlak_customers")
        .select("id, name, phone, email")
        .eq("id", customer_id).eq("user_id", pt.user_id).maybeSingle(),
      sb.from("profiles")
        .select("tenant_id, whatsapp_phone")
        .eq("id", pt.user_id).single(),
    ]);

    if (!propRes.data) return NextResponse.json({ error: "Mülk bulunamadı." }, { status: 404 });
    if (!custRes.data) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });

    const prop = propRes.data;
    const cust = custRes.data;
    const profile = profileRes.data;

    const propAddress = [prop.location_neighborhood, prop.location_district, prop.location_city]
      .filter(Boolean).join(", ");

    const signToken = randomBytes(16).toString("hex");

    const { data: contract, error } = await sb
      .from("contracts")
      .insert({
        tenant_id: profile?.tenant_id || null,
        user_id: pt.user_id,
        property_id: prop.id,
        type: "yetkilendirme",
        status: "pending_signature",
        sign_token: signToken,
        contract_data: {
          property_title: prop.title || null,
          property_address: propAddress || null,
          property_type: prop.type || null,
          listing_type: prop.listing_type || null,
          owner_name: cust.name,
          owner_phone: cust.phone || null,
          owner_email: cust.email || null,
          customer_id: cust.id,
          exclusive: !!exclusive,
          commission: Number(commission) || 2,
          duration: Number(duration) || 3,
        },
      })
      .select("id")
      .single();

    if (error || !contract) {
      console.error("[sozlesme:save]", error);
      return NextResponse.json({ error: "Sözleşme kaydedilemedi." }, { status: 500 });
    }

    // WA bildirimi (best-effort) — Panele Git CTA'sı sendBackToPanel ile sonradan
    if (profile?.whatsapp_phone) {
      try {
        const { sendText } = await import("@/platform/whatsapp/send");
        const { sendBackToPanel } = await import("@/tenants/emlak/menu");
        const signLink = `${APP_URL}/tr/sign/${signToken}`;
        await sendText(profile.whatsapp_phone,
          `📝 *Sözleşme oluşturuldu*\n\n` +
          `🏠 ${prop.title || propAddress || "Mülk"}\n` +
          `👤 ${cust.name}\n\n` +
          `İmza linki:\n${signLink}\n\n` +
          `_Müşterinize bu linki iletin; imzaladığında size haber gelecek._`,
        );
        await sendBackToPanel(pt.user_id, profile.whatsapp_phone);
      } catch (notifyErr) {
        console.error("[sozlesme:save] notify failed:", notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      contract_id: contract.id,
      sign_link: `${APP_URL}/tr/sign/${signToken}`,
    });
  } catch (err) {
    console.error("[sozlesme:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
