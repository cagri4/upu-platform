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
import { getTenantByKey, getTenantByDomain, isAdminDomain } from "@/tenants/config";
import { createTenantForSignup } from "@/platform/auth/tenant-provision";
import { profilKurulumRedirectFor } from "@/platform/auth/profil-kurulum-redirect";
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

// 2026-06-05 kök fix: bu helper kaldırıldı. Config sadece DEMO tenant id'lerini
// tutuyor; runtime'da signup yeni tenants satırı yaratıyor (UUID) → config
// lookup null döner, kullanıcı yanlış panele (emlak default) yönlenirdi.
// Yerine login branch'i DB'den tenants.saas_type'ı join ile çekiyor.

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
    // 2026-06-05 KÖK FIX: tenant.saas_type'ı DB'den join ile çek (config DEMO
    // id'lerine takılma). Signup runtime'da yeni tenants satırı yaratıyor;
    // config lookup null dönüyor, kullanıcı yanlış panele (emlak default)
    // yönleniyor → "Oturum bulunamadı".
    const { data: profile } = await sb
      .from("profiles")
      .select("id, tenant_id, role, tenants(saas_type)")
      .eq("whatsapp_phone", phone)
      .limit(1)
      .maybeSingle();
    if (!profile) {
      // Race condition: OTP request'te vardı, verify'da yok — yine de no_account
      return NextResponse.json({ error: "no_account" }, { status: 404 });
    }

    // Admin domaininden (adminpanel.upudev.nl) giren admin → admin paneli.
    // Diğer tüm durumlar tenant panel path'ine, saas_type'a göre.
    const h = await headers();
    const host = h.get("host") || "";
    let redirect: string;
    if (profile.role === "admin" && isAdminDomain(host)) {
      redirect = `/${locale}/admin`;
    } else {
      const saasType = ((profile as { tenants?: { saas_type?: string } | null }).tenants?.saas_type) ?? null;
      const panelPath = getTenantPanelPath(saasType);
      redirect = `/${locale}${panelPath.replace(/^\/[a-z]{2}/, "")}`;
      if (!saasType) {
        console.warn("[otp:verify:login] profile.tenant_id has no joined saas_type — falling back to default panel", {
          uid: profile.id,
          tenantId: profile.tenant_id,
        });
      }
    }

    const res = NextResponse.json({ ok: true, redirect });
    const finalRes = await attachSessionToResponse(res, {
      uid: profile.id as string,
      tenantId: (profile.tenant_id as string | null) ?? null,
    });
    // Login flow guard — Set-Cookie header'ı yazıldı mı doğrula. Yazılmadıysa
    // browser cookie almayacak ve user "Oturum bulunamadı" ile dönecek; net
    // 500 hatası dönerek retry'a şans tanı.
    const setCookieHdr = finalRes.headers.get("set-cookie");
    if (!setCookieHdr || !setCookieHdr.includes("upu_session")) {
      console.error("[otp:verify:login] Set-Cookie header missing after attach", {
        uid: profile.id,
      });
      return NextResponse.json({ error: "session_attach_failed" }, { status: 500 });
    }
    return finalRes;
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

  // KATMAN B (2026-06-06): outer try/catch ile rollback hardening.
  // Önceki kod her adımda inline error check yapıyordu ama throw'lar (network,
  // PostgREST runtime) try'a yakalanmıyor, sonraki rollback satırına ulaşılmıyordu.
  // 2026-06-05'te 3 bayi orphan'ın bu yüzden DB'de kaldığı tespit edildi
  // (.planning/TENANT-AUDIT-2026-06-06.md). Şimdi tüm yan etkiler track edilip
  // throw veya error response'unda toparlanıyor.
  let createdTenantId: string | null = null;
  let createdAuthUserId: string | null = null;
  try {
    const tenantInsert = await createTenantForSignup(sb, {
      ownerName: phone,
      tenantKey: tenant.key,
    });
    if (!tenantInsert.ok) {
      console.error("[otp:verify:signup] tenant insert failed", tenantInsert.error);
      return NextResponse.json({ error: "internal" }, { status: 500 });
    }
    createdTenantId = tenantInsert.tenantId;

    const placeholderEmail = `otp_${tenant.key}_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`;
    const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
      email: placeholderEmail,
      email_confirm: true,
      user_metadata: { name: phone, phone, source: "otp-signup" },
    });
    if (authErr || !authUser?.user) {
      console.error("[otp:verify:signup] auth.admin.createUser failed", authErr);
      throw new Error("auth_create_failed");
    }
    createdAuthUserId = authUser.user.id;

    const newProfileId = randomUUID();
    const { data: newProfile, error: insErr } = await sb
      .from("profiles")
      .insert({
        id: newProfileId,
        auth_user_id: createdAuthUserId,
        whatsapp_phone: phone,
        tenant_id: createdTenantId,
        display_name: phone,
        preferred_locale: locale,
      })
      .select("id")
      .single();
    if (insErr || !newProfile) {
      console.error("[otp:verify:signup] profile insert failed", insErr);
      throw new Error("profile_insert_failed");
    }

    const redirect = profilKurulumRedirectFor(tenant.key, locale);
    const res = NextResponse.json({ ok: true, redirect });
    return await attachSessionToResponse(res, {
      uid: newProfile.id as string,
      tenantId: createdTenantId,
    });
  } catch (err) {
    console.error("[otp:verify:signup] flow failed, rolling back side effects", {
      err: (err as Error)?.message,
      createdTenantId,
      createdAuthUserId,
    });
    if (createdAuthUserId) {
      await sb.auth.admin.deleteUser(createdAuthUserId).catch((e) =>
        console.error("[otp:verify:signup] rollback deleteUser failed", e),
      );
    }
    if (createdTenantId) {
      await sb.from("tenants").delete().eq("id", createdTenantId).then(({ error }) => {
        if (error) console.error("[otp:verify:signup] rollback tenants.delete failed", error);
      });
    }
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
