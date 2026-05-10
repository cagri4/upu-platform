/**
 * Cookie-öncelikli + token-fallback panel auth helper.
 *
 * Kullanım (API endpoint'lerinde):
 *   const auth = await resolvePanelAuth(req);
 *   if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
 *   const userId = auth.userId;
 */
import type { NextRequest } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies } from "@/platform/auth/session";

export type PanelAuthResult =
  | { userId: string }
  | { error: string; status: number };

export async function resolvePanelAuth(req: NextRequest): Promise<PanelAuthResult> {
  // 1) Cookie session öncelik
  const session = await getSessionFromCookies();
  if (session?.uid) return { userId: session.uid };

  // 2) Token query fallback (legacy WA URL'leri)
  const token =
    req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return { error: "Oturum bulunamadı.", status: 401 };

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!pt) return { error: "Geçersiz link.", status: 404 };
  if (new Date(pt.expires_at) < new Date()) {
    return { error: "Linkin süresi dolmuş.", status: 400 };
  }
  return { userId: pt.user_id };
}

/**
 * POST body içinde token gelen endpoint'ler için (örn /api/takip/save).
 * Body opsiyoneldir; cookie öncelikli.
 */
export async function resolvePanelAuthFromBody(
  req: NextRequest,
  body: { token?: string },
): Promise<PanelAuthResult> {
  const session = await getSessionFromCookies();
  if (session?.uid) return { userId: session.uid };

  const token = body?.token;
  if (!token) return { error: "Oturum bulunamadı.", status: 401 };

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!pt) return { error: "Geçersiz link.", status: 404 };
  if (new Date(pt.expires_at) < new Date()) {
    return { error: "Linkin süresi dolmuş.", status: 400 };
  }
  return { userId: pt.user_id };
}
