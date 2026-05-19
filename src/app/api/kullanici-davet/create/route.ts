/**
 * POST /api/kullanici-davet/create
 *
 * Admin'in şirketine iç kullanıcı (muhasebe/depocu/satis) davet etmesi.
 * Bot otomatik mesaj göndermez — WA Cloud API 24h window kuralı.
 *
 * Body: { name, phone, role: 'admin'|'muhasebe'|'depocu'|'satis' }
 *
 * Akış:
 *   1. Admin auth + bayi tenant guard + sadece admin role
 *   2. invite_token üret (32-char hex), user_invitations row insert
 *   3. share_message + accept_url + share_phone dön
 *   4. Frontend modal 3 paylaş buton (Kopyala/WA/SMS), admin kendi WA'sından
 *      paylaşır → kullanıcı bot'a yazar → 24h window açılır
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";
const VALID_ROLES = new Set(["admin", "muhasebe", "depocu", "satis"]);

const ROLE_LABEL: Record<string, string> = {
  admin: "Yönetici",
  muhasebe: "Muhasebe",
  depocu: "Depo",
  satis: "Satış",
};

function normalizePhone(input: string): string {
  return input.replace(/[^\d]/g, "");
}

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostTenant = getTenantByDomain(host);
  if (hostTenant?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde kullanılır." }, { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null;
    role: string | null;
    metadata: Record<string, unknown> | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, display_name, role, metadata",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  if (lookup.profile.role !== "admin") {
    return NextResponse.json({ error: "Sadece firma yöneticisi kullanıcı davet edebilir." }, { status: 403 });
  }

  let body: { name?: string; phone?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const phone = normalizePhone(body.phone ?? "");
  const role = (body.role ?? "").toLowerCase();

  if (name.length < 2) return NextResponse.json({ error: "İsim soyisim en az 2 karakter." }, { status: 400 });
  if (!/^[0-9]{10,15}$/.test(phone)) {
    return NextResponse.json({ error: "Geçerli bir telefon girin (10-15 hane)." }, { status: 400 });
  }
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  const tenantId = lookup.tenantId;

  // Aynı tenant'ta zaten bu phone ile pending davet var mı?
  const { data: pending } = await sb
    .from("user_invitations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("invitee_phone", phone)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();
  if (pending) {
    return NextResponse.json({ error: "Bu telefon için zaten aktif bir davet var." }, { status: 409 });
  }

  const inviteToken = randomBytes(16).toString("hex");
  const { data: inv, error: insertErr } = await sb
    .from("user_invitations")
    .insert({
      tenant_id: tenantId,
      inviter_user_id: lookup.profile.id,
      invitee_phone: phone,
      invitee_name: name,
      role,
      invite_token: inviteToken,
      status: "pending",
    })
    .select("id, invite_token, role")
    .single();

  if (insertErr || !inv) {
    console.error("[kullanici-davet/create]", insertErr);
    return NextResponse.json({ error: "Davet oluşturulamadı." }, { status: 500 });
  }

  const inviterMeta = (lookup.profile.metadata as Record<string, unknown> | null) || {};
  const firma = (inviterMeta.firma_profili as { ticari_unvan?: string } | null) || null;
  const inviterName = firma?.ticari_unvan || lookup.profile.display_name || "Şirketiniz";

  const acceptUrl = `${APP_URL}/kullanici-davet/${inviteToken}`;
  const roleLabel = ROLE_LABEL[role] || role;
  const shareMessage =
    `Merhaba ${name}, ${inviterName} sizi UPU sistemine ${roleLabel} rolü ile davet ediyor. ` +
    `Hesabınızı aktifleştirmek için: ${acceptUrl} (7 gün geçerli).`;

  return NextResponse.json({
    ok: true,
    invite_id: inv.id,
    invite_token: inv.invite_token,
    role,
    role_label: roleLabel,
    accept_url: acceptUrl,
    share_message: shareMessage,
    share_phone: phone,
  });
}
