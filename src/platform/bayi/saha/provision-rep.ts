/**
 * Saha satış elemanı portal login provizyonu — Faz 6.
 *
 * Saha elemanı /tr/saha portalına telefon + OTP ile girer. Bunun için
 * elemanın bir `profiles` satırı (role='saha', tenant_id = dağıtıcının
 * tenant'ı) olması gerekir. Bu helper o profili oluşturur veya mevcutu
 * linkler.
 *
 * Telefon GLOBAL UNIQUE (bayi CLAUDE.md): 1 telefon = 1 SaaS hesabı. Bu
 * yüzden:
 *   - aynı tenant'ta zaten profil varsa → linkle (idempotent)
 *   - BAŞKA tenant'ta profil varsa → reddet (phone_taken)
 *   - hiç yoksa → auth user + profile yarat (role='employee')
 *
 * NOT: role='employee' kullanılır (profiles_role_check izinli set'i: admin/
 * employee/dealer/system/user/guest/site-rolleri — 'saha' YOK). 'employee'
 * ayrıca getDagiticiAuth allowlist'inde (admin/user/satis) DEĞİL → saha
 * elemanı dağıtıcı paneline giremez. Saha kimliği rol değil bayi_sales_reps
 * linki ile belirlenir (getSahaAuth).
 *
 * OTP signup akışındaki (otp/verify) provizyon pattern'ini izler ama yeni
 * tenant YARATMAZ — eleman dağıtıcının mevcut tenant'ına bağlanır.
 */
import { randomBytes, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProvisionResult =
  | { ok: true; profileId: string; mode: "linked" | "created" }
  | { ok: false; error: "phone_taken" | "internal" };

export async function provisionSalesRepLogin(
  sb: SupabaseClient,
  args: { tenantId: string; phone: string; name: string; locale?: string },
): Promise<ProvisionResult> {
  const { tenantId, phone, name } = args;
  const locale = args.locale || "tr";

  // Global telefon lookup
  const { data: existing } = await sb
    .from("profiles")
    .select("id, tenant_id")
    .eq("whatsapp_phone", phone)
    .limit(1)
    .maybeSingle();

  if (existing) {
    if ((existing.tenant_id as string) === tenantId) {
      return { ok: true, profileId: existing.id as string, mode: "linked" };
    }
    // Başka tenant'a kilitli telefon
    return { ok: false, error: "phone_taken" };
  }

  // Yeni auth user + profile (role='saha'). Rollback hardening (otp/verify
  // pattern'i): auth user yaratıldı ama profile patladıysa auth user'ı sil.
  let createdAuthUserId: string | null = null;
  try {
    const placeholderEmail = `saha_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`;
    const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
      email: placeholderEmail,
      email_confirm: true,
      user_metadata: { name, phone, source: "saha-rep-provision" },
    });
    if (authErr || !authUser?.user) {
      console.error("[saha:provision] createUser failed", authErr);
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
        tenant_id: tenantId,
        display_name: name,
        role: "employee",
        preferred_locale: locale,
      })
      .select("id")
      .single();
    if (insErr || !newProfile) {
      console.error("[saha:provision] profile insert failed", insErr);
      throw new Error("profile_insert_failed");
    }

    return { ok: true, profileId: newProfile.id as string, mode: "created" };
  } catch (err) {
    console.error("[saha:provision] failed, rolling back", (err as Error)?.message);
    if (createdAuthUserId) {
      await sb.auth.admin
        .deleteUser(createdAuthUserId)
        .catch((e) => console.error("[saha:provision] rollback deleteUser failed", e));
    }
    return { ok: false, error: "internal" };
  }
}
