/**
 * Standart API auth resolver — cookie session öncelikli, token fallback.
 *
 * Tüm "fetcher" API endpoint'leri (verileri okuyan, mutate eden) bu helper'ı
 * çağırır. Magic-link "login" endpoint'leri (session attach yapanlar) bunu
 * KULLANMAZ — onlar token verify + attachSessionToResponse pattern'ini korur.
 *
 * Kullanım:
 *   import { requireAuth } from "@/platform/auth/require-auth";
 *
 *   export async function GET(req: NextRequest) {
 *     const auth = await requireAuth(req);
 *     if ("error" in auth) return auth.error;
 *     // auth.userId hazır — DB query'lerde tenant_id filter ekle
 *   }
 *
 * Auth fail → JSON 401 (veya resolvePanelAuth'ın döndürdüğü status).
 * Backward compat: ?t=<token> URL parametresi hala destekleniyor.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { resolvePanelAuth } from "./panel-auth";
import { getSessionFromCookies } from "./session";
import { getServiceClient } from "./supabase";

export type RequireAuthResult =
  | { userId: string }
  | { error: NextResponse };

export async function requireAuth(req: NextRequest): Promise<RequireAuthResult> {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return {
      error: NextResponse.json(
        { error: auth.error },
        { status: auth.status || 401 },
      ),
    };
  }
  return { userId: auth.userId };
}

/**
 * POST endpoint'leri için — body veya query'den token alır, cookie session
 * öncelikli. `magicTokenId` null olduğunda used_at update edilmez (cookie
 * session'ı tek-kullanım değil).
 *
 * Magic-link "single-use" davranışını koruyan save endpoint'leri (örn
 * bayi-siparis/save) bu helper'ı kullanır:
 *
 *   const auth = await requireAuthFromBody(req, body);
 *   if ("error" in auth) return auth.error;
 *   // ... işle ...
 *   if (auth.magicTokenId) {
 *     await sb.from("magic_link_tokens").update({ used_at: ... }).eq("id", auth.magicTokenId);
 *   }
 */
export type RequireAuthFromBodyResult =
  | { userId: string; magicTokenId: string | null }
  | { error: NextResponse };

export async function requireAuthFromBody(
  req: NextRequest,
  body: { token?: string | null } | undefined | null,
): Promise<RequireAuthFromBodyResult> {
  // 1) Cookie öncelik
  const session = await getSessionFromCookies();
  if (session?.uid) return { userId: session.uid, magicTokenId: null };

  // 2) Token fallback — body öncelik, query backup
  const token =
    (body && typeof body.token === "string" ? body.token : null) ||
    req.nextUrl.searchParams.get("t") ||
    req.nextUrl.searchParams.get("token");
  if (!token) {
    return {
      error: NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 }),
    };
  }

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  if (!pt) {
    return { error: NextResponse.json({ error: "Geçersiz link." }, { status: 404 }) };
  }
  if (pt.used_at) {
    return { error: NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 }) };
  }
  if (new Date(pt.expires_at) < new Date()) {
    return { error: NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 }) };
  }
  return { userId: pt.user_id, magicTokenId: pt.id };
}
