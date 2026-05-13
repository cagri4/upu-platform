/**
 * WA OTP step-up — Faz 6.6.
 *
 * Hassas işlemler (Google unlink, üyelik iptal vb.) için ikinci doğrulama.
 * Kullanıcı WA'ya gönderilen 6 haneli kodu girer → `upu_step_up` cookie
 * 10 dakika geçerli. Sensitive endpoint'ler `requireWaStepUp(req, uid)`
 * çağırarak guard'lanır.
 *
 * Mimari notu: cookie tabanlı — DB roundtrip yok (challenge verify sonrası
 * cookie sign'lanır, sonraki sensitive call'larda JWT verify yeterli). Cookie
 * cihaza özel; multi-cihaz sync yok (güvenlik için lokal doğrulama doğru).
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { NextRequest, NextResponse } from "next/server";

const STEP_UP_COOKIE = "upu_step_up";
const STEP_UP_TTL_SECONDS = 10 * 60; // 10 dakika

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error("SESSION_SECRET tanımlı değil");
  return new TextEncoder().encode(raw);
}

export interface StepUpToken {
  uid: string;
  verifiedAt: number; // unix seconds
}

export async function signStepUp(uid: string): Promise<string> {
  return await new SignJWT({
    uid,
    verifiedAt: Math.floor(Date.now() / 1000),
  } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STEP_UP_TTL_SECONDS}s`)
    .sign(getSecret());
}

/** Cookie domain: prod'da `.upudev.nl`, dev'de yok. session.ts pattern'i. */
function getCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== "production") return undefined;
  return ".upudev.nl";
}

/**
 * Verify endpoint'i NextResponse'a step-up cookie ekler.
 */
export function attachStepUpCookieToResponse(
  response: NextResponse,
  token: string,
): NextResponse {
  response.cookies.set({
    name: STEP_UP_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STEP_UP_TTL_SECONDS,
    domain: getCookieDomain(),
  });
  return response;
}

/**
 * Sensitive action endpoint'lerinde çağrılır. Cookie 10 dk içinde set edilmiş
 * + UID eşleşiyorsa OK. Aksi halde error code döner; frontend modal açıp
 * /api/auth/step-up/start ve /verify ile cookie kazandırır, sonra action'ı
 * yeniden dener.
 */
export async function requireWaStepUp(
  req: NextRequest,
  uid: string,
): Promise<
  | { ok: true }
  | { ok: false; error: "step_up_required" | "step_up_invalid" }
> {
  const c = req.cookies.get(STEP_UP_COOKIE)?.value;
  if (!c) return { ok: false, error: "step_up_required" };
  try {
    const { payload } = await jwtVerify(c, getSecret());
    if (typeof payload.uid !== "string") {
      return { ok: false, error: "step_up_invalid" };
    }
    if (payload.uid !== uid) return { ok: false, error: "step_up_invalid" };
    return { ok: true };
  } catch {
    // JWT expired/invalid → cookie zaten kullanışsız
    return { ok: false, error: "step_up_required" };
  }
}

export const STEP_UP_COOKIE_NAME = STEP_UP_COOKIE;
