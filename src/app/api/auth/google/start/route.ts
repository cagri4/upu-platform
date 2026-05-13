/**
 * GET /api/auth/google/start
 *
 * Google OAuth flow başlangıcı. Supabase'in PKCE flow'unu kullanıyoruz
 * (@supabase/ssr); code_verifier cookie'si Supabase tarafından otomatik
 * set ediliyor, callback'te aynı cookie ile code → session değişimi olur.
 *
 * Query params:
 *   - next: başarı sonrası dönülecek path (default /tr/panel)
 *   - mode: "link" → panel-içi Google bağlama akışı (cookie session gerek)
 *   - pid:  profile id (link mode'da hangi profile'a bağlanacağı)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/tr/panel";
  const mode = url.searchParams.get("mode") || "";
  const pid = url.searchParams.get("pid") || "";

  const cookieStore = await cookies();
  const setCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
        },
        setAll(items) {
          for (const it of items) setCookies.push(it);
        },
      },
    },
  );

  // Callback URL — mode/pid state'ini callback query ile taşıyoruz
  const cbParams = new URLSearchParams({ next });
  if (mode === "link") {
    cbParams.set("mode", "link");
    if (pid) cbParams.set("pid", pid);
  }
  const callbackUrl = `${url.origin}/api/auth/google/callback?${cbParams.toString()}`;

  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl, skipBrowserRedirect: true },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${url.origin}/tr/giris?error=oauth_init`);
  }

  const res = NextResponse.redirect(data.url);
  for (const c of setCookies) {
    res.cookies.set(c.name, c.value, c.options);
  }
  return res;
}
