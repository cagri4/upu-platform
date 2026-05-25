/**
 * GET /api/auth/google/callback
 *
 * Google OAuth dönüş noktası. Supabase ?code= ile redirect eder, PKCE
 * code_verifier cookie ile birlikte oturum tokenları için değişilir.
 *
 * İki mod:
 *   - default (login): google_sub / google_email ile mevcut profile aranır.
 *     Bulunursa kendi JWT cookie'mizi set edip next'e redirect; bulunmazsa
 *     /tr/giris?error=no_account&hint=wa_first ile WA-first onboarding'e
 *     yönlendir (Faz 6.3 ile login sayfası hazır).
 *   - mode=link: panel-içi Google bağlama. Cookie session uid ile pid
 *     eşleşmeli, google_sub başka profile'da kullanılmamalı. Mevcut
 *     profile'a google_sub/email kaydedilir, yeni cookie üretilmez.
 *
 * Faz 6.1 — WA-first onboarding KORUNUR (Google ile yeni profile yaratmıyor).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/platform/auth/supabase";
import {
  attachSessionToResponse,
  getSessionFromCookies,
} from "@/platform/auth/session";
import { getTenantByDomain } from "@/tenants/config";
import { getTenantPanelPath } from "@/platform/auth/qr";

export const dynamic = "force-dynamic";

interface MinimalProfile {
  id: string;
  tenant_id: string | null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // Tenant-aware default — start endpoint zaten next'i set ediyor ama
  // direct callback hit (test/legacy) durumunda host header'dan resolve.
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  const next = url.searchParams.get("next") || getTenantPanelPath(hostTenant?.key ?? null);
  const mode = url.searchParams.get("mode") || "";
  const pid = url.searchParams.get("pid") || "";

  // Error redirect base — mode'a göre kullanıcının döneceği yer.
  //   link mode → /tr/panel-ayarlari (kullanıcı oradan başlattı)
  //   login mode → /tr/giris (Faz 6.3 login sayfası error toast render eder)
  const errBase = mode === "link" ? "/tr/panel-ayarlari" : "/tr/giris";

  if (!code) {
    return NextResponse.redirect(`${url.origin}${errBase}?error=missing_code`);
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

  const { data: exchanged, error: exErr } = await sb.auth.exchangeCodeForSession(code);
  if (exErr || !exchanged?.user) {
    return NextResponse.redirect(
      `${url.origin}${errBase}?error=oauth_exchange&detail=${encodeURIComponent(exErr?.message || "")}`,
    );
  }

  const supaUser = exchanged.user as {
    email?: string;
    user_metadata?: Record<string, unknown>;
    identities?: Array<{ provider: string; identity_data?: Record<string, unknown> }>;
  };
  const googleEmail = supaUser.email;
  const googleIdentity = supaUser.identities?.find((i) => i.provider === "google");
  const googleSub =
    (googleIdentity?.identity_data?.sub as string | undefined) ||
    (supaUser.user_metadata?.sub as string | undefined) ||
    (supaUser.user_metadata?.provider_id as string | undefined);

  if (!googleEmail || !googleSub) {
    return NextResponse.redirect(`${url.origin}${errBase}?error=oauth_no_email`);
  }

  const admin = getServiceClient();

  // ===== LINK MODE — panel-içi Google bağlama =====
  if (mode === "link") {
    const session = await getSessionFromCookies();
    if (!session?.uid || (pid && session.uid !== pid)) {
      return NextResponse.redirect(`${url.origin}/tr/panel-ayarlari?error=link_unauthorized`);
    }

    // google_sub başka profile'da mı?
    const { data: clash } = await admin
      .from("profiles")
      .select("id")
      .eq("google_sub", googleSub)
      .neq("id", session.uid)
      .maybeSingle();
    if (clash) {
      return NextResponse.redirect(`${url.origin}${next}?error=google_already_linked`);
    }

    await admin
      .from("profiles")
      .update({
        google_sub: googleSub,
        google_email: googleEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.uid);

    const res = NextResponse.redirect(`${url.origin}${next}?linked=1`);
    for (const c of setCookies) res.cookies.set(c.name, c.value, c.options);
    return res;
  }

  // ===== LOGIN MODE — mevcut profile bul =====
  let profile: MinimalProfile | null = null;

  // 1) google_sub (en stable)
  const { data: bySub } = await admin
    .from("profiles")
    .select("id, tenant_id")
    .eq("google_sub", googleSub)
    .maybeSingle();
  if (bySub) profile = bySub as MinimalProfile;

  // 2) google_email fallback
  if (!profile) {
    const { data: byEmail } = await admin
      .from("profiles")
      .select("id, tenant_id")
      .ilike("google_email", googleEmail)
      .maybeSingle();
    if (byEmail) profile = byEmail as MinimalProfile;
  }

  // 3) WA-first onboarding: profile yoksa yeni profile YARATMA.
  //    Kullanıcı önce WA ile kayıt olmalı, Faz 6.2'de panel-içi "Google bağla".
  if (!profile) {
    // Faz 6.3 /tr/giris error toast'ı bu hint'i "wa_first" mesajı ile
    // gösterir — kullanıcı WhatsApp ile bağlanmaya yönlendirilir.
    return NextResponse.redirect(`${url.origin}/tr/giris?error=no_account&hint=wa_first`);
  }

  // google_sub henüz yoksa idempotent kaydet (kullanıcı 2'inci girişinde sub set olur)
  await admin
    .from("profiles")
    .update({
      google_sub: googleSub,
      google_email: googleEmail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  // Kendi JWT cookie'mizi set et + redirect
  const res = NextResponse.redirect(`${url.origin}${next}`);
  for (const c of setCookies) res.cookies.set(c.name, c.value, c.options);
  return await attachSessionToResponse(res, {
    uid: profile.id,
    tenantId: profile.tenant_id,
  });
}
