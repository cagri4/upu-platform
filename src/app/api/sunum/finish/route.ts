/**
 * /api/sunum/finish — kullanıcı sunumun sonundaki "Devam Et" butonuna
 * tıklayınca çağrılır. Idempotent: content.finished_at flag ile sadece
 * ilk tıklamada WA'ya "Mülkleri Yönet" mesajı + magic link butonu
 * gönderir. Sonraki tıklamalarda WA spam atılmaz.
 *
 * POST { token }   (sunum magic_token'ı)
 *
 * Yanıt: { success: true, wa_url: "https://wa.me/..." } — client bu URL'e
 * navigate eder.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const BOT_WA_NUMBER = "31644967207";

interface PresContent {
  finished_at?: string | null;
  [k: string]: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

    const supabase = getServiceClient();
    const { data: pres } = await supabase
      .from("emlak_presentations")
      .select("id, user_id, content")
      .eq("magic_token", token)
      .single();

    if (!pres) return NextResponse.json({ error: "Sunum bulunamadı." }, { status: 404 });

    const content: PresContent = (pres.content as PresContent) || {};
    const alreadyFinished = !!content.finished_at;

    // Her durumda WhatsApp deep link döner
    const waUrl = `https://wa.me/${BOT_WA_NUMBER}`;

    if (alreadyFinished) {
      return NextResponse.json({ success: true, wa_url: waUrl, already_finished: true });
    }

    // İdempotent: flag'i şimdi set et, sonra after() içinde WA gönder
    const newContent = { ...content, finished_at: new Date().toISOString() };
    await supabase.from("emlak_presentations")
      .update({ content: newContent })
      .eq("id", pres.id);

    // Free-ride pattern (2026-05-06): "Mülkleri Yönet" chain transition
    // kaldırıldı. Kullanıcı Panel'den kendi seçimi yapar.

    return NextResponse.json({ success: true, wa_url: waUrl });
  } catch (err) {
    console.error("[sunum:finish]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
