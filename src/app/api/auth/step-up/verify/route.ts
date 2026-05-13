/**
 * POST /api/auth/step-up/verify
 *
 * Body: { challengeId: string, code: string }
 *   - Cookie session zorunlu
 *   - DB'den challenge fetch (verified_at NULL, expires_at > now, aynı profile)
 *   - attempt_count++ (5'i aşarsa invalidate)
 *   - Kod eşleşirse: verified_at=now, step-up cookie sign + set
 *   - Yanıt: { ok: true } veya { error: "invalid_code"|"expired"|"too_many_attempts"|"not_found" }
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getServiceClient } from "@/platform/auth/supabase";
import { signStepUp, attachStepUpCookieToResponse } from "@/platform/auth/step-up";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.userId;

  const body = (await req.json().catch(() => ({}))) as {
    challengeId?: string;
    code?: string;
  };
  const challengeId = body.challengeId;
  const code = (body.code || "").trim();

  if (!challengeId || !code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = getServiceClient();
  const { data: ch } = await admin
    .from("step_up_challenges")
    .select("id, code, attempt_count, verified_at, expires_at, profile_id")
    .eq("id", challengeId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!ch) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (ch.verified_at) {
    return NextResponse.json({ error: "already_used" }, { status: 400 });
  }
  if (new Date(ch.expires_at as string) <= new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }
  if ((ch.attempt_count as number) >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
  }

  // attempt_count++ (kod eşleşmezse de sayıyı artırırız)
  const nextAttempts = (ch.attempt_count as number) + 1;
  const isMatch = ch.code === code;

  if (!isMatch) {
    await admin
      .from("step_up_challenges")
      .update({ attempt_count: nextAttempts })
      .eq("id", challengeId);
    if (nextAttempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
    }
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  // Match: verified_at set + step-up cookie sign
  await admin
    .from("step_up_challenges")
    .update({
      attempt_count: nextAttempts,
      verified_at: new Date().toISOString(),
    })
    .eq("id", challengeId);

  const token = await signStepUp(userId);
  const res = NextResponse.json({ ok: true });
  return attachStepUpCookieToResponse(res, token);
}
