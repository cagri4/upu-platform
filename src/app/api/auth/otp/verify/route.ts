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
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { getServiceClient } from "@/platform/auth/supabase";
import { attachSessionToResponse } from "@/platform/auth/session";
import { getTenantPanelPath } from "@/platform/auth/qr";
import { getAllTenants, getTenantByKey } from "@/tenants/config";
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
      .select("id, tenant_id")
      .eq("whatsapp_phone", phone)
      .limit(1)
      .maybeSingle();
    if (!profile) {
      // Race condition: OTP request'te vardı, verify'da yok — yine de no_account
      return NextResponse.json({ error: "no_account" }, { status: 404 });
    }

    const tenantKey = resolveTenantKeyByTenantId(profile.tenant_id as string | null);
    const panelPath = getTenantPanelPath(tenantKey);
    const redirect = `/${locale}${panelPath.replace(/^\/[a-z]{2}/, "")}`;

    const res = NextResponse.json({ ok: true, redirect });
    return await attachSessionToResponse(res, {
      uid: profile.id as string,
      tenantId: (profile.tenant_id as string | null) ?? null,
    });
  }

  // signup
  const h = await headers();
  const tenantKey = h.get("x-tenant-key");
  const tenant = tenantKey ? getTenantByKey(tenantKey) : null;
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

  const { data: newProfile, error: insErr } = await sb
    .from("profiles")
    .insert({
      whatsapp_phone: phone,
      tenant_id: tenant.tenantId,
    })
    .select("id")
    .single();
  if (insErr || !newProfile) {
    console.error("[otp:verify:signup] profile insert failed", insErr);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }

  const redirect = `/${locale}/profil-kurulum`;
  const res = NextResponse.json({ ok: true, redirect });
  return await attachSessionToResponse(res, {
    uid: newProfile.id as string,
    tenantId: tenant.tenantId,
  });
}
