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
const ADMIN_COOKIE_NAME = "upu_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 gün

// Cookie isim ayrımı (2026-06-07 — kök neden fix):
// Adminpanel ve SaaS panel'leri aynı `.upudev.nl` cookie domain'i kullanıyor.
// Eski tasarım iki tarafta da TEK `upu_session` ismini kullanınca, kullanıcının
// aynı tarayıcıdan retailai signup yapması adminpanel session'ını eziyordu
// (browser aynı isim+domain → overwrite). Ayrı isim = ayrı slot = ezişme yok.

export interface PanelSession {
  uid: string;
  tenantId: string | null;
  /** JWT issued-at (unix saniye). H-10 session revocation karşılaştırması için. */
  iat?: number;
}

/**
 * H-10 (2026-06-11 hardening): token, kullanıcının sessions_revoked_at
 * damgasından ÖNCE üretildiyse iptal edilmiş sayılır (logout / "tüm
 * oturumları kapat"). revokedAt null ise hiçbir token etkilenmez (default).
 */
export function isSessionRevoked(
  iat: number | undefined,
  revokedAt: string | null | undefined,
): boolean {
  if (!revokedAt || typeof iat !== "number") return false;
  return iat * 1000 < new Date(revokedAt).getTime();
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

/**
 * JWT verify — başarısız durumda kalıcı observability log atar.
 * Token full şekilde sızdırılmaz; sadece ilk 12 karakter + uzunluk.
 * Üretim ortamında Vercel function log'ları bu satırları yakalar.
 */
export async function verifySession(token: string): Promise<PanelSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.uid !== "string") {
      console.warn("[verifySession] invalid payload — uid not string", {
        payloadKeys: Object.keys(payload),
      });
      return null;
    }
    return {
      uid: payload.uid,
      tenantId: typeof payload.tenantId === "string" ? payload.tenantId : null,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch (err) {
    // Observability — JWT verify failure'ları sessizce yutmak Bug 2/3 (2026-06-05)
    // ile maliyetli oldu. jose error code'ları (ERR_JWT_EXPIRED, ERR_JWS_INVALID,
    // ERR_JWS_SIGNATURE_VERIFICATION_FAILED, ...) prod log'larında okunabilir
    // kalır. Token sızıntısı yok — sadece head/length.
    const code = (err as { code?: string } | null)?.code;
    const message = (err as Error | null)?.message;
    console.warn("[verifySession] jwt verify failed", {
      code,
      message,
      tokenHead: token.slice(0, 12),
      tokenLen: token.length,
    });
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

// ─── Admin session helpers (ayrı cookie namespace) ────────────────────────
// 2026-06-07 — Bkz. ADMIN_COOKIE_NAME yorumu yukarıda.

function buildCookieForName(cookieName: string, jwt: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${cookieName}=${jwt}`,
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

function buildClearForName(cookieName: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${cookieName}=`,
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

export async function getAdminSessionFromCookies(): Promise<PanelSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function attachAdminSessionToResponse(
  response: NextResponse,
  session: PanelSession,
): Promise<NextResponse> {
  const jwt = await signSession(session);
  response.headers.append("Set-Cookie", buildCookieForName(ADMIN_COOKIE_NAME, jwt));
  return response;
}

export function attachAdminClearToResponse(response: NextResponse): NextResponse {
  response.headers.append("Set-Cookie", buildClearForName(ADMIN_COOKIE_NAME));
  return response;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_SESSION_COOKIE_NAME = ADMIN_COOKIE_NAME;
