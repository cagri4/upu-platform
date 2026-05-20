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
