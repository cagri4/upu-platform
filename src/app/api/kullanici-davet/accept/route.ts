/**
 * POST /api/kullanici-davet/accept
 * Body: { token }
 *
 * Davet kabul — çalışan link tıklayıp "Devam Et" yaptığında:
 *   1. user_invitations row validate (pending + expires_at > now)
 *   2. Mevcut auth.user var mı (başka tenant'ta profile)? → multi-tenant
 *      profile (fresh UUID, auth_user_id=same). Yoksa
 *      auth.admin.createUser + legacy profile.
 *   3. runTenantSignup ile bayi tenant'ta profile oluştur, ROLE
 *      user_invitations.role'dan atanır (admin/muhasebe/depocu/satis).
 *   4. user_invitations status='accepted' + accepted_user_id
 *   5. Cookie session attach + bayi-panel redirect
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByKey } from "@/tenants/config";
import { runTenantSignup } from "@/platform/whatsapp/organic-signup";
import { attachSessionToResponse } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";

export async function POST(req: NextRequest) {
  try {
    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
    }
    const token = body.token;
    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });

    const sb = getServiceClient();
    const { data: inv } = await sb
      .from("user_invitations")
      .select("id, invitee_name, invitee_phone, role, status, expires_at, tenant_id, inviter_user_id")
      .eq("invite_token", token)
      .maybeSingle();
    if (!inv) return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
    if (inv.status !== "pending") {
      return NextResponse.json({ error: "Davet zaten kullanılmış veya iptal edilmiş." }, { status: 410 });
    }
    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ error: "Davet süresi dolmuş." }, { status: 410 });
    }

    const bayiCfg = getTenantByKey("bayi");
    if (!bayiCfg || bayiCfg.tenantId !== inv.tenant_id) {
      return NextResponse.json({ error: "Tenant uyumsuz." }, { status: 500 });
    }
    const bayiTenantId = bayiCfg.tenantId;

    // Aynı tenant'ta zaten bu phone ile profile var mı?
    const { data: existing } = await sb
      .from("profiles")
      .select("id, role")
      .eq("whatsapp_phone", inv.invitee_phone)
      .eq("tenant_id", bayiTenantId)
      .maybeSingle();
    if (existing) {
      // Mevcut profile — sadece role güncelle + auto-login
      await sb.from("profiles").update({ role: inv.role }).eq("id", existing.id);
      await sb.from("user_invitations").update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: existing.id,
      }).eq("id", inv.id);

      const response = NextResponse.json({
        ok: true,
        already_registered: true,
        redirect: `${APP_URL}/tr/bayi-panel`,
      });
      return await attachSessionToResponse(response, {
        uid: existing.id,
        tenantId: bayiTenantId,
      });
    }

    // Yeni profile — mevcut auth.user var mı (başka tenant)?
    const { data: anyExistingProfile } = await sb
      .from("profiles")
      .select("auth_user_id")
      .eq("whatsapp_phone", inv.invitee_phone)
      .limit(1)
      .maybeSingle();

    let authUserId: string;
    let isLegacyAuth: boolean;

    if (anyExistingProfile?.auth_user_id) {
      authUserId = anyExistingProfile.auth_user_id;
      isLegacyAuth = false;
    } else {
      const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
        email: `bayi_user_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
        email_confirm: true,
        user_metadata: { name: inv.invitee_name },
      });
      if (authErr || !authUser?.user) {
        console.error("[kullanici-davet/accept] createUser err:", authErr);
        return NextResponse.json({ error: "Hesap oluşturulamadı." }, { status: 500 });
      }
      authUserId = authUser.user.id;
      isLegacyAuth = true;
    }

    const handled = await runTenantSignup(sb, {
      authUserId,
      phone: inv.invitee_phone,
      name: inv.invitee_name ?? "",
      tenantKey: "bayi",
      isLegacyAuth,
    });
    if (!handled) return NextResponse.json({ error: "Kayıt akışı başlatılamadı." }, { status: 500 });

    // Profile bul + role + invited_by güncelle
    const { data: bayiProfile } = await sb
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("tenant_id", bayiTenantId)
      .maybeSingle();
    if (!bayiProfile) return NextResponse.json({ error: "Profil oluşturulamadı." }, { status: 500 });

    await sb.from("profiles").update({
      role: inv.role,
      invited_by: inv.inviter_user_id,
    }).eq("id", bayiProfile.id);

    await sb.from("user_invitations").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: bayiProfile.id,
    }).eq("id", inv.id);

    const response = NextResponse.json({
      ok: true,
      redirect: `${APP_URL}/tr/bayi-panel`,
    });
    return await attachSessionToResponse(response, {
      uid: bayiProfile.id,
      tenantId: bayiTenantId,
    });
  } catch (err) {
    console.error("[kullanici-davet/accept]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
