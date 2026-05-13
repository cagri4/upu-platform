/**
 * Panel session — JWT signed cookie tabanlı oturum.
 *
 * Magic link tıklandığında ilgili init endpoint cookie set eder; sonraki
 * ziyaretlerde URL'de token gerekmez. URL temiz kalır, browser history'de
 * token sızmaz.
 *
 * Cookie özellikleri:
 *   - HttpOnly  → JS'ten okunamaz (XSS koruma)
 *   - Secure    → sadece HTTPS (prod)
 *   - SameSite=Lax → top-level GET navigation'lara cookie gönderilir (OAuth
 *     callback redirect chain için gerek). POST/iframe'de engellenir, CSRF
 *     koruması yeterli. Strict OAuth flow'unda cookie kaybeder.
 *   - Path=/    → tüm panel route'larında
 *   - MaxAge    → 30 gün (sliding refresh, /me her isabet ettiğinde uzar)
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "upu_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 gün

export interface PanelSession {
  uid: string;
  tenantId: string | null;
}

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error("SESSION_SECRET env değişkeni tanımlı değil.");
  return new TextEncoder().encode(raw);
}

export async function signSession(payload: PanelSession): Promise<string> {
  return await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<PanelSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.uid !== "string") return null;
    return {
      uid: payload.uid,
      tenantId: typeof payload.tenantId === "string" ? payload.tenantId : null,
    };
  } catch {
    return null;
  }
}

/**
 * Cookie domain: prod'da `.upudev.nl` (parent domain) → tüm subdomain'lerde
 * paylaşımlı olur (estateai/retailai/marketai/otelai/restoranai/qr).
 * Bu sayede `qr.upudev.nl`'de tarayıcıya set edilen session cookie'si
 * tenant subdomain'lerinde de geçerli olur. Dev (NODE_ENV=development)
 * ortamında localhost için domain set edilmez (browser kabul etmez).
 */
function getCookieDomain(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  return ".upudev.nl";
}

export function buildSessionCookie(jwt: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${jwt}`,
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  const domain = getCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCookie(): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  const domain = getCookieDomain();
  if (domain) parts.push(`Domain=${domain}`);
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Server-side cookie okuma (route handler / server component).
 * Next.js 16: cookies() async döner.
 */
export async function getSessionFromCookies(): Promise<PanelSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySession(token);
}

/**
 * Response'a session cookie ekleyen yardımcı.
 */
export async function attachSessionToResponse(
  response: NextResponse,
  session: PanelSession,
): Promise<NextResponse> {
  const jwt = await signSession(session);
  response.headers.append("Set-Cookie", buildSessionCookie(jwt));
  return response;
}

export function attachClearToResponse(response: NextResponse): NextResponse {
  response.headers.append("Set-Cookie", buildClearCookie());
  return response;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
