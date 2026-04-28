/**
 * POST /api/bayi-profil/save — save firma profili (zorunlu 5 + opsiyonel)
 * to profiles.metadata.firma_profili. Triggers discovery chain step 1
 * (firma_kaydedildi) which fires the next-step magic link via WA.
 *
 * Body: {
 *   token,
 *   ticari_unvan, yetkili_adi, ofis_telefon, ofis_adresi, sektor,    // zorunlu
 *   vergi_dairesi?, vergi_no?, kurulus_yili?, email_kurumsal?,
 *   web_sitesi?, iban?, banka?, hesap_sahibi?, tanitim?
 * }
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REQUIRED = ["ticari_unvan", "yetkili_adi", "ofis_telefon", "ofis_adresi", "sektor"] as const;

const SEKTOR_VALUES = new Set([
  "boya", "insaat", "elektrik", "tesisat", "hirdavat",
  "klima", "mobilya", "gida", "otomotiv", "tekstil", "diger",
]);

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = s(body.token);
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

    // Required field validation
    for (const k of REQUIRED) {
      if (!s(body[k])) return NextResponse.json({ error: `Zorunlu alan eksik: ${k}` }, { status: 400 });
    }
    const ticariUnvan = s(body.ticari_unvan);
    const yetkiliAdi = s(body.yetkili_adi);
    const ofisTelefon = s(body.ofis_telefon);
    const ofisAdresi = s(body.ofis_adresi);
    const sektor = s(body.sektor);

    if (ticariUnvan.length < 2) return NextResponse.json({ error: "Ticari unvan en az 2 karakter olmalı." }, { status: 400 });
    if (yetkiliAdi.length < 2) return NextResponse.json({ error: "Yetkili adı en az 2 karakter olmalı." }, { status: 400 });
    if (ofisTelefon.replace(/\D/g, "").length < 10) {
      return NextResponse.json({ error: "Geçerli telefon girin (en az 10 hane)." }, { status: 400 });
    }
    if (!SEKTOR_VALUES.has(sektor)) {
      return NextResponse.json({ error: "Geçerli sektör seçin." }, { status: 400 });
    }

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
      .select("id, tenant_id, whatsapp_phone, metadata")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const existingMeta = (profile.metadata || {}) as Record<string, unknown>;
    const firmaProfili = {
      ticari_unvan: ticariUnvan,
      yetkili_adi: yetkiliAdi,
      ofis_telefon: ofisTelefon,
      ofis_adresi: ofisAdresi,
      sektor,
      vergi_dairesi: s(body.vergi_dairesi) || null,
      vergi_no: s(body.vergi_no) || null,
      kurulus_yili: s(body.kurulus_yili) || null,
      email_kurumsal: s(body.email_kurumsal) || null,
      web_sitesi: s(body.web_sitesi) || null,
      iban: s(body.iban).replace(/\s+/g, "") || null,
      banka: s(body.banka) || null,
      hesap_sahibi: s(body.hesap_sahibi) || null,
      tanitim: s(body.tanitim) || null,
      completed_at: new Date().toISOString(),
    };

    const newMeta = {
      ...existingMeta,
      firma_profili: firmaProfili,
      firma_profili_completed: true,
    };

    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        metadata: newMeta,
        display_name: yetkiliAdi,
      })
      .eq("id", profile.id);

    if (updErr) {
      console.error("[bayi-profil:save]", updErr);
      return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
    }

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    const userId = profile.id;
    const userPhone = profile.whatsapp_phone as string | undefined;

    after(async () => {
      try {
        if (!userPhone) return;
        const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
        await advanceDiscovery(userId, "bayi", userPhone, "firma_kaydedildi");
      } catch (err) {
        console.error("[bayi-profil:save] WA chain failed:", err);
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[bayi-profil:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
