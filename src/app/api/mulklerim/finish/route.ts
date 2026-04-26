/**
 * /api/mulklerim/finish — kullanıcı /tr/mulklerim sayfasından "WA'a dön"
 * butonuna tıkladığında tetiklenir. Idempotent (profile.metadata
 * .mulklerim_finished_at flag): ilk tıklamada WA'ya "Sıradaki: Müşteri
 * Ekle" mesajı + magic link butonu gönderilir.
 *
 * POST { token }
 * Yanıt: { success: true, wa_url: "https://wa.me/..." }
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const BOT_WA_NUMBER = "31644967207";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

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

    const waUrl = `https://wa.me/${BOT_WA_NUMBER}`;

    // İdempotent flag: profile.metadata.mulklerim_finished_at
    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata, whatsapp_phone")
      .eq("id", magicToken.user_id)
      .single();
    const meta = (profile?.metadata as Record<string, unknown> | null) || {};

    if (meta.mulklerim_finished_at) {
      return NextResponse.json({ success: true, wa_url: waUrl, already_finished: true });
    }

    const newMeta = { ...meta, mulklerim_finished_at: new Date().toISOString() };
    await supabase.from("profiles").update({ metadata: newMeta }).eq("id", magicToken.user_id);

    after(async () => {
      try {
        const phone = profile?.whatsapp_phone as string | undefined;
        if (!phone) return;

        const sb = getServiceClient();
        const musteriToken = randomBytes(16).toString("hex");
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await sb.from("magic_link_tokens").insert({
          user_id: magicToken.user_id,
          token: musteriToken,
          expires_at: expires,
        });
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
        const musteriUrl = `${appUrl}/tr/musteri-ekle-form?t=${musteriToken}`;

        await sendUrlButton(
          phone,
          `🤝 *Sıradaki: Müşteri Ekle*\n\nBir müşteri profili ekleyin — ileride mülklerinizle eşleştirip otomatik sunum hazırlamanıza yardım ederim. Aşağıdaki formdan müşterinin bilgilerini ve aradığı kriterleri paylaşın.`,
          "🤝 Müşteri Ekle",
          musteriUrl,
          { skipNav: true },
        );
      } catch (err) {
        console.error("[mulklerim:finish]", err);
      }
    });

    return NextResponse.json({ success: true, wa_url: waUrl });
  } catch (err) {
    console.error("[mulklerim:finish]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
