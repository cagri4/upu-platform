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
import { getSessionFromCookies } from "@/platform/auth/session";
import { getTenantByDomain } from "@/tenants/config";
import { getTenantPanelPath } from "@/platform/auth/qr";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "";
  // Tenant-aware default panelPath — host header'dan resolve. siteyonetim'de
  // /tr/site, bayi'de /tr/bayi-panel, vs. Explicit ?next= override eder.
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  const tenantPanelPath = getTenantPanelPath(hostTenant?.key ?? null);
  // Link mode default next → panel-ayarlari; login mode → tenant panel
  const next =
    url.searchParams.get("next") ||
    (mode === "link" ? "/tr/panel-ayarlari" : tenantPanelPath);

  // Link mode: cookie session zorunlu (pid server-derived, client'a güvenmeyiz).
  // Cookie yoksa panel-ayarlari'na error ile dön (kullanıcı oraya giriş yapmaya
  // çalıştı; /tr/giris henüz yok).
  let pid: string | null = null;
  if (mode === "link") {
    const session = await getSessionFromCookies();
    if (!session?.uid) {
      return NextResponse.redirect(`${url.origin}/tr/panel-ayarlari?error=login_required`);
    }
    pid = session.uid;
  }

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
    // Mode'a göre kullanıcının döneceği yer
    //   link mode → panel-ayarlari (UI error toast render eder)
    //   login mode → /tr/giris (Faz 6.3 login sayfası error toast render eder)
    const errReturn = mode === "link" ? "/tr/panel-ayarlari" : "/tr/giris";
    return NextResponse.redirect(`${url.origin}${errReturn}?error=oauth_init`);
  }

  const res = NextResponse.redirect(data.url);
  for (const c of setCookies) {
    res.cookies.set(c.name, c.value, c.options);
  }
  return res;
}
