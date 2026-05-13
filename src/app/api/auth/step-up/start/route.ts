/**
 * POST /api/auth/step-up/start
 *
 * WA OTP challenge başlatır:
 *   1) Cookie session zorunlu
 *   2) Son 1 saatte 3+ challenge ise rate limit (429)
 *   3) 6 haneli kod üret, step_up_challenges'a kaydet
 *   4) profile.whatsapp_phone'a sendText ile gönder
 *   5) Response: { ok: true, challengeId }
 *
 * Frontend StepUpModal bu endpoint'i çağırır, sonra /verify ile kod gönderir.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 saat
const RATE_LIMIT_MAX = 3;

export async function POST(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.userId;

  const admin = getServiceClient();

  // Rate limit — son 1 saatte profile için kaç challenge üretilmiş?
  const sinceIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("step_up_challenges")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", userId)
    .gte("created_at", sinceIso);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429 },
    );
  }

  // Profile WA telefonunu bul
  const { data: profile } = await admin
    .from("profiles")
    .select("whatsapp_phone, display_name")
    .eq("id", userId)
    .single();
  if (!profile?.whatsapp_phone) {
    return NextResponse.json({ error: "wa_phone_missing" }, { status: 400 });
  }

  // 6 haneli kod (100000-999999)
  const code = String(randomInt(100000, 1000000));

  const { data: challenge, error: insErr } = await admin
    .from("step_up_challenges")
    .insert({
      profile_id: userId,
      code,
      // expires_at default: now() + 5 min
    })
    .select("id")
    .single();

  if (insErr || !challenge) {
    return NextResponse.json({ error: "challenge_create_failed" }, { status: 500 });
  }

  // WA mesaj — basit text. Bot infra mevcut (sendText).
  const msg = `🔐 UPU Güvenlik Kodu: ${code}\n\n5 dakika geçerli. Sen istemediysen yok say.`;
  try {
    await sendText(profile.whatsapp_phone as string, msg);
  } catch (err) {
    console.error("[step-up:start] WA send failed", err);
    // Mesaj gitmese bile challenge DB'de — kullanıcı yeniden başlatabilir
    return NextResponse.json({ error: "wa_send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, challengeId: challenge.id });
}
