/**
 * OTP altyapısı — login/signup/2fa/recovery için tek modül.
 *
 * Tablo: `otp_codes` (20260528064135_otp_codes.sql).
 * Template: Meta `upu_otp_giris` (AUTHENTICATION, tr/en/nl) — onaylı, COPY_CODE.
 * Helper: `sendOtpTemplate(phone, code, lang)` (src/platform/whatsapp/templates.ts).
 *
 * Mevcut `step_up_challenges` (Faz 6.6) pattern'inden esinlenir; ama signup
 * için `profile_id` FK'siz çalışması gerekiyordu, ayrı tablo açtık.
 */
import { randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendOtpTemplate, type WaLang } from "@/platform/whatsapp/templates";

export type OtpPurpose = "login" | "signup" | "2fa" | "recovery";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 dk
const RATE_LIMIT_MAX_PER_PHONE = 3;
const RATE_LIMIT_MAX_PER_IP = 5;
const MAX_VERIFY_ATTEMPTS = 5;

const OTP_PURPOSES: ReadonlySet<OtpPurpose> = new Set([
  "login",
  "signup",
  "2fa",
  "recovery",
]);

const WA_LANGS: ReadonlySet<WaLang> = new Set(["tr", "en", "nl"]);

export function isOtpPurpose(value: unknown): value is OtpPurpose {
  return typeof value === "string" && OTP_PURPOSES.has(value as OtpPurpose);
}

export function isWaLang(value: unknown): value is WaLang {
  return typeof value === "string" && WA_LANGS.has(value as WaLang);
}

/**
 * E.164 normalize — UI tarafından gelen ham telefon string'ini DB için
 * tutarlı formata getirir.
 *
 * Kabul edilen girdiler:
 *   "+90 532 123 45 67" → "905321234567"
 *   "0090532..."        → "90532..."
 *   "+31 6 44 96 72 07" → "31644967207"
 *
 * Reddedilen: lokal format ("0532...", "0644...") — caller country code
 * eklemek zorunda (UI'da country code prefix'i olur).
 */
export function normalizePhoneE164(raw: string): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim().replace(/[\s\-()]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  if (!/^\d{8,15}$/.test(s)) return null;
  return s;
}

function generateOtpCode(): string {
  // 6 haneli — step_up_challenges pattern'i. randomInt cryptographic.
  return String(randomInt(100000, 1000000));
}

export interface OtpRequestInput {
  phone: string; // normalized E.164
  purpose: OtpPurpose;
  locale: WaLang;
  tenantId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export type OtpRequestResult =
  | { ok: true }
  | {
      ok: false;
      error: "rate_limited" | "wa_send_failed" | "internal";
      status: number;
    };

export async function requestOtp(
  sb: SupabaseClient,
  input: OtpRequestInput,
): Promise<OtpRequestResult> {
  const sinceIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  // Phone başına rate-limit
  const { count: phoneCount } = await sb
    .from("otp_codes")
    .select("*", { count: "exact", head: true })
    .eq("phone", input.phone)
    .gte("created_at", sinceIso);
  if ((phoneCount ?? 0) >= RATE_LIMIT_MAX_PER_PHONE) {
    return { ok: false, error: "rate_limited", status: 429 };
  }

  // IP başına rate-limit (varsa) — birden fazla telefon spam'i engeller
  if (input.ip) {
    const { count: ipCount } = await sb
      .from("otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", input.ip)
      .gte("created_at", sinceIso);
    if ((ipCount ?? 0) >= RATE_LIMIT_MAX_PER_IP) {
      return { ok: false, error: "rate_limited", status: 429 };
    }
  }

  const code = generateOtpCode();
  const { error: insErr } = await sb.from("otp_codes").insert({
    phone: input.phone,
    code,
    purpose: input.purpose,
    tenant_id: input.tenantId ?? null,
    ip_address: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  });
  if (insErr) {
    console.error("[otp:request] insert failed", insErr);
    return { ok: false, error: "internal", status: 500 };
  }

  // Test identity bypass — phone admin_test_identities'te ise WA'ya gönderme,
  // sadece o satıra last_otp_code/at yaz. Admin paneli 5sn polling ile
  // kodu okur, tek-tık kopyalar. Sanal telefon flow (905552221122 vb).
  const { data: testIdentity } = await sb
    .from("admin_test_identities")
    .select("id")
    .eq("virtual_phone", input.phone)
    .limit(1)
    .maybeSingle();

  if (testIdentity) {
    const { error: updErr } = await sb
      .from("admin_test_identities")
      .update({
        last_otp_code: code,
        last_otp_at: new Date().toISOString(),
      })
      .eq("id", testIdentity.id);
    if (updErr) {
      console.error("[otp:request] test-identity capture failed", updErr);
      return { ok: false, error: "internal", status: 500 };
    }
    return { ok: true };
  }

  const send = await sendOtpTemplate(input.phone, code, input.locale);
  if (!send.ok) {
    console.error("[otp:request] WA send failed", send.error);
    return { ok: false, error: "wa_send_failed", status: 502 };
  }

  return { ok: true };
}

export interface OtpVerifyInput {
  phone: string; // normalized E.164
  code: string;  // 6 digits
  purpose: OtpPurpose;
}

export type OtpVerifyResult =
  | { ok: true; otpId: string; tenantId: string | null }
  | {
      ok: false;
      error:
        | "not_found"
        | "expired"
        | "already_used"
        | "invalid_code"
        | "too_many_attempts";
      status: number;
    };

export async function verifyOtp(
  sb: SupabaseClient,
  input: OtpVerifyInput,
): Promise<OtpVerifyResult> {
  // Phone + purpose için en güncel verify edilmemiş kayıt
  const { data: ch } = await sb
    .from("otp_codes")
    .select("id, code, attempt_count, verified_at, expires_at, tenant_id")
    .eq("phone", input.phone)
    .eq("purpose", input.purpose)
    .is("verified_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ch) return { ok: false, error: "not_found", status: 404 };
  if (ch.verified_at) return { ok: false, error: "already_used", status: 400 };
  if (new Date(ch.expires_at as string) <= new Date()) {
    return { ok: false, error: "expired", status: 400 };
  }
  if ((ch.attempt_count as number) >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "too_many_attempts", status: 429 };
  }

  const nextAttempts = (ch.attempt_count as number) + 1;
  const isMatch = ch.code === input.code;

  if (!isMatch) {
    await sb
      .from("otp_codes")
      .update({ attempt_count: nextAttempts })
      .eq("id", ch.id);
    if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
      return { ok: false, error: "too_many_attempts", status: 429 };
    }
    return { ok: false, error: "invalid_code", status: 400 };
  }

  await sb
    .from("otp_codes")
    .update({
      attempt_count: nextAttempts,
      verified_at: new Date().toISOString(),
    })
    .eq("id", ch.id);

  return {
    ok: true,
    otpId: ch.id as string,
    tenantId: (ch.tenant_id as string | null) ?? null,
  };
}
