/**
 * /api/websayfam/finish — kullanıcı /tr/web-sayfam panelinden "WA'a Dön"
 * butonuna tıklayınca tetiklenir. Idempotent (profile.metadata
 * .websayfam_finished_at flag): ilk tıklamada WA'ya "Sahibinden'e
 * İlan Yükle" mesajı + Chrome extension setup yönergesi gönderilir.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const BOT_WA_NUMBER = "31644967207";
const EXTENSION_URL = "https://chromewebstore.google.com/detail/bcafoeijofbhelbanpfjhmhiokjnggbe";

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata, whatsapp_phone")
      .eq("id", magicToken.user_id)
      .single();
    const meta = (profile?.metadata as Record<string, unknown> | null) || {};

    if (meta.websayfam_finished_at) {
      return NextResponse.json({ success: true, wa_url: waUrl, already_finished: true });
    }

    const newMeta = { ...meta, websayfam_finished_at: new Date().toISOString() };
    await supabase.from("profiles").update({ metadata: newMeta }).eq("id", magicToken.user_id);

    after(async () => {
      try {
        const phone = profile?.whatsapp_phone as string | undefined;
        if (!phone) return;

        const sb = getServiceClient();

        // 6-haneli pairing kodu — uzantı için
        const { data: existing } = await sb
          .from("extension_tokens")
          .select("token")
          .eq("user_id", magicToken.user_id)
          .maybeSingle();

        let code: string;
        if (existing) {
          code = (existing.token as string).substring(0, 6).toUpperCase();
        } else {
          const fullToken = randomBytes(24).toString("hex");
          code = fullToken.substring(0, 6).toUpperCase();
          await sb.from("extension_tokens").insert({
            user_id: magicToken.user_id,
            token: fullToken,
          });
        }

        const text =
          `🧩 *Sıradaki: Sahibinden'e İlan Yükle*\n\n` +
          `Eklediğiniz mülklerin sahibinden.com ilanlarını dakikalar içinde otomatik dolduran Chrome uzantımızı kullanın.\n\n` +
          `*3 adımda kurulum:*\n` +
          `1️⃣ Bilgisayarınızda Chrome'a uzantıyı kurun:\n${EXTENSION_URL}\n\n` +
          `2️⃣ Uzantıya tıklayın, eşleşme kodunuzu girin: *${code}*\n\n` +
          `3️⃣ sahibinden.com/ilan-ver sayfasını açın → uzantıdan mülkünüzü seçin → form 30 saniyede dolar.\n\n` +
          `_Tek seferlik kurulum — sonra her ilanda kullanılabilir._`;

        await sendButtons(phone, text, [
          { id: "cmd:menu", title: "📋 Ana Menü" },
        ]);
      } catch (err) {
        console.error("[websayfam:finish]", err);
      }
    });

    return NextResponse.json({ success: true, wa_url: waUrl });
  } catch (err) {
    console.error("[websayfam:finish]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
