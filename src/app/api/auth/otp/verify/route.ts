/**
 * POST /api/auth/otp/verify
 *
 * Body: { phone, code, purpose: "login"|"signup", locale }
 *
 * Akış:
 *   1) Body validate + phone normalize
 *   2) verifyOtp(sb, {phone, code, purpose}) → DB kayıt + attempt++ + match
 *   3) Login: phone'a profile bul → cookie attach (uid=profile.id,
 *      tenantId=profile.tenant_id) → { ok, redirect: panelPath }
 *   4) Signup: tenant header'dan, profiles satırı yarat (boş; sadece
 *      whatsapp_phone + tenant_id), cookie attach → { ok, redirect:
 *      /<locale>/profil-kurulum }
 *
 * Tenant key reverse lookup: profile.tenant_id → getAllTenants ile key bul
 * → getTenantPanelPath(key).
 */
import { randomBytes, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServiceClient } from "@/platform/auth/supabase";
import { attachSessionToResponse } from "@/platform/auth/session";
import { getTenantPanelPath } from "@/platform/auth/qr";
import { getAllTenants, getTenantByKey, getTenantByDomain, isAdminDomain } from "@/tenants/config";
import {
  verifyOtp,
  isOtpPurpose,
  isWaLang,
  normalizePhoneE164,
  type OtpPurpose,
} from "@/platform/auth/otp";

export const dynamic = "force-dynamic";

interface RequestBody {
  phone?: string;
  code?: string;
  purpose?: string;
  locale?: string;
}

function resolveTenantKeyByTenantId(tenantId: string | null): string | null {
  if (!tenantId) return null;
  const match = getAllTenants().find((t) => t.tenantId === tenantId);
  return match?.key ?? null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;

  if (!isOtpPurpose(body.purpose)) {
    return NextResponse.json({ error: "bad_purpose" }, { status: 400 });
  }
  if (body.purpose !== "login" && body.purpose !== "signup") {
    return NextResponse.json({ error: "purpose_not_supported" }, { status: 400 });
  }
  const purpose: OtpPurpose = body.purpose;

  // Admin domain'den signup yapılamaz. Adminpanel mevcut admin'in girdiği yer;
  // public signup yüzeyi tutmaz. Middleware UI tarafını kapatıyor; bu blok
  // direkt API çağrılarına karşı son hat. (Telefon GLOBAL UNIQUE olduğu için
  // izin verseydik admin tenant'a çöp profile + phone kilitlenmesi olurdu.)
  if (purpose === "signup") {
    const hostHeader = (await headers()).get("host") || "";
    if (isAdminDomain(hostHeader)) {
      return NextResponse.json({ error: "signup_not_allowed_on_admin" }, { status: 403 });
    }
  }

  // Locale opsiyonel — verify response redirect locale prefix'i için
  const locale = isWaLang(body.locale) ? body.locale : "tr";

  const phone = normalizePhoneE164(body.phone ?? "");
  if (!phone) {
    return NextResponse.json({ error: "bad_phone" }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "bad_code" }, { status: 400 });
  }

  const sb = getServiceClient();

  const verify = await verifyOtp(sb, { phone, code, purpose });
  if (!verify.ok) {
    return NextResponse.json({ error: verify.error }, { status: verify.status });
  }

  if (purpose === "login") {
    const { data: profile } = await sb
      .from("profiles")
      .select("id, tenant_id, role")
      .eq("whatsapp_phone", phone)
      .limit(1)
      .maybeSingle();
    if (!profile) {
      // Race condition: OTP request'te vardı, verify'da yok — yine de no_account
      return NextResponse.json({ error: "no_account" }, { status: 404 });
    }

    // Admin domaininden (adminpanel.upudev.nl) giren admin → admin paneli.
    // Diğer tüm durumlar (normal tenant kullanıcısı VEYA admin'in bir tenant
    // subdomain'inden girişi) değişmeden eski davranışta: tenant panel path.
    const h = await headers();
    const host = h.get("host") || "";
    let redirect: string;
    if (profile.role === "admin" && isAdminDomain(host)) {
      redirect = `/${locale}/admin`;
    } else {
      const tenantKey = resolveTenantKeyByTenantId(profile.tenant_id as string | null);
      const panelPath = getTenantPanelPath(tenantKey);
      redirect = `/${locale}${panelPath.replace(/^\/[a-z]{2}/, "")}`;
    }

    const res = NextResponse.json({ ok: true, redirect });
    return await attachSessionToResponse(res, {
      uid: profile.id as string,
      tenantId: (profile.tenant_id as string | null) ?? null,
    });
  }

  // signup — tenant resolve: middleware /api/ paths'i atlar, x-tenant-key
  // boş gelir → Host header'dan getTenantByDomain fallback (codebase pattern,
  // bkz. api/bayi-payments/*).
  const h = await headers();
  const tenantKey = h.get("x-tenant-key");
  const signupHost = h.get("host") ?? "";
  const tenant =
    (tenantKey ? getTenantByKey(tenantKey) : null) ?? getTenantByDomain(signupHost);
  if (!tenant?.tenantId) {
    return NextResponse.json({ error: "tenant_missing" }, { status: 400 });
  }

  // Race re-check
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .eq("whatsapp_phone", phone)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "already_exists" }, { status: 409 });
  }

  // profiles.auth_user_id NOT NULL → önce auth.user yaratılmalı (placeholder
  // email pattern, organic-signup ile aynı). Profil minimum dolu yaratılır
  // (display_name = telefon, role/capabilities boş; profil-kurulum sayfası
  // tamamlatır).
  const placeholderEmail = `otp_${tenant.key}_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`;
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email: placeholderEmail,
    email_confirm: true,
    user_metadata: { name: phone, phone, source: "otp-signup" },
  });
  if (authErr || !authUser?.user) {
    console.error("[otp:verify:signup] auth.admin.createUser failed", authErr);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
  const authUserId = authUser.user.id;

  const newProfileId = randomUUID();
  const { data: newProfile, error: insErr } = await sb
    .from("profiles")
    .insert({
      id: newProfileId,
      auth_user_id: authUserId,
      whatsapp_phone: phone,
      tenant_id: tenant.tenantId,
      display_name: phone,
      preferred_locale: locale,
    })
    .select("id")
    .single();
  if (insErr || !newProfile) {
    console.error("[otp:verify:signup] profile insert failed", insErr);
    // Cleanup: auth.user dangling kalmasın
    await sb.auth.admin.deleteUser(authUserId).catch(() => undefined);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  const redirect = `/${locale}/profil-kurulum`;
  const res = NextResponse.json({ ok: true, redirect });
  return await attachSessionToResponse(res, {
    uid: newProfile.id as string,
    tenantId: tenant.tenantId,
  });
}
