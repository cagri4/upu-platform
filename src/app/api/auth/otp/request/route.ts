/**
 * POST /api/auth/otp/request
 *
 * Body: { phone: string, purpose: "login"|"signup", locale: "tr"|"en"|"nl" }
 *
 * Akış:
 *   1) Body validate + phone normalize (E.164)
 *   2) Tenant resolve (x-tenant-key header → tenants.id)
 *   3) purpose=login → phone'a profile var mı (yoksa 404 no_account, UI'da
 *      'üye ol' linki)
 *   4) purpose=signup → phone'a profile var mı (varsa 409 already_exists,
 *      UI'da 'giriş yap' linki)
 *   5) requestOtp → rate-limit + insert + Meta upu_otp_giris template gönder
 *
 * Response: { ok: true } | { error: "rate_limited"|"no_account"|... }
 */
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByKey, getTenantByDomain, isAdminDomain } from "@/tenants/config";
import {
  requestOtp,
  isOtpPurpose,
  isWaLang,
  normalizePhoneE164,
  type OtpPurpose,
} from "@/platform/auth/otp";

export const dynamic = "force-dynamic";

interface RequestBody {
  phone?: string;
  purpose?: string;
  locale?: string;
}

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") || null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;

  if (!isOtpPurpose(body.purpose)) {
    return NextResponse.json({ error: "bad_purpose" }, { status: 400 });
  }
  // 2fa/recovery şu an UI yok — Faz 1'de login + signup yeterli.
  if (body.purpose !== "login" && body.purpose !== "signup") {
    return NextResponse.json({ error: "purpose_not_supported" }, { status: 400 });
  }
  const purpose: OtpPurpose = body.purpose;

  // Admin domain'den signup yok — verify ile birlikte iki katlı blok (UI: middleware).
  if (purpose === "signup") {
    const hostHeader = (await headers()).get("host") || "";
    if (isAdminDomain(hostHeader)) {
      return NextResponse.json({ error: "signup_not_allowed_on_admin" }, { status: 403 });
    }
  }

  if (!isWaLang(body.locale)) {
    return NextResponse.json({ error: "bad_locale" }, { status: 400 });
  }
  const locale = body.locale;

  const phone = normalizePhoneE164(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ error: "bad_phone" }, { status: 400 });
  }

  const sb = getServiceClient();

  // Tenant resolve: middleware /api/ paths'i atlar, x-tenant-key normalde
  // boş gelir → Host header'dan getTenantByDomain ile çöz (codebase pattern,
  // bkz. api/bayi-payments/*).
  const h = await headers();
  const tenantKey = h.get("x-tenant-key");
  const hostForTenant = h.get("host") ?? "";
  const tenant =
    (tenantKey ? getTenantByKey(tenantKey) : null) ?? getTenantByDomain(hostForTenant);
  const tenantId = tenant?.tenantId ?? null;

  // purpose-based pre-check (phone global unique → tek satır kontrolü)
  if (purpose === "login") {
    const { data: profile } = await sb
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", phone)
      .limit(1)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "no_account" }, { status: 404 });
    }
  } else {
    const { data: profile } = await sb
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", phone)
      .limit(1)
      .maybeSingle();
    if (profile) {
      return NextResponse.json({ error: "already_exists" }, { status: 409 });
    }
  }

  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");

  const result = await requestOtp(sb, {
    phone,
    purpose,
    locale,
    tenantId,
    ip,
    userAgent: ua,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
