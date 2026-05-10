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
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const BOT_WA_NUMBER = "31644967207";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const userId = auth.userId;
    const waUrl = `https://wa.me/${BOT_WA_NUMBER}`;

    // İdempotent flag: profile.metadata.mulklerim_finished_at
    const { data: profile } = await supabase
      .from("profiles")
      .select("metadata, whatsapp_phone")
      .eq("id", userId)
      .single();
    const meta = (profile?.metadata as Record<string, unknown> | null) || {};

    if (meta.mulklerim_finished_at) {
      return NextResponse.json({ success: true, wa_url: waUrl, already_finished: true });
    }

    const newMeta = { ...meta, mulklerim_finished_at: new Date().toISOString() };
    await supabase.from("profiles").update({ metadata: newMeta }).eq("id", userId);

    // Free-ride pattern (2026-05-06): "Sıradaki: Müşteri Ekle" chain
    // transition kaldırıldı. Kullanıcı Panel'den kendi seçimi yapar.

    return NextResponse.json({ success: true, wa_url: waUrl });
  } catch (err) {
    console.error("[mulklerim:finish]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
