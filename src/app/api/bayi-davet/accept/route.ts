/**
 * POST /api/bayi-davet/accept
 * Body: { code }
 *
 * Davet kabul:
 *   1. Davet validate (pending + expires_at > now)
 *   2. Multi-tenant signup: runTenantSignup helper reuse
 *      - Mevcut auth.users varsa (başka tenant'ta profile var) → multi-tenant
 *        bayi profile (id=fresh UUID, auth_user_id=same)
 *      - Brand new phone → auth.admin.createUser + legacy profile
 *   3. Profile metadata.firma_profili'ye davet bilgilerini yaz (ticari_unvan,
 *      adres, vergi no).
 *   4. dealer_invitations status='accepted' + accepted_user_id
 *   5. Cookie session attach → bayi panel redirect URL döner
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
    let body: { code?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }
    const code = body.code?.toUpperCase();
    if (!code) return NextResponse.json({ error: "Davet kodu gerekli." }, { status: 400 });

    const sb = getServiceClient();
    const { data: inv } = await sb
      .from("dealer_invitations")
      .select("id, phone, name, store_name, store_address, tax_no, status, expires_at, distributor_tenant_id")
      .eq("invite_code", code)
      .maybeSingle();

    if (!inv) return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });
    if (inv.status !== "pending") {
      return NextResponse.json({ error: "Davet zaten kullanılmış veya iptal edilmiş." }, { status: 410 });
    }
    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ error: "Davet süresi dolmuş." }, { status: 410 });
    }

    const bayiCfg = getTenantByKey("bayi");
    if (!bayiCfg) return NextResponse.json({ error: "Bayi config bulunamadı." }, { status: 500 });

    // Mevcut auth.user var mı (başka tenant'ta profile var mı)?
    const { data: anyExistingProfile } = await sb
      .from("profiles")
      .select("auth_user_id, id")
      .eq("whatsapp_phone", inv.phone)
      .limit(1)
      .maybeSingle();

    let authUserId: string;
    let isLegacyAuth: boolean;

    if (anyExistingProfile?.auth_user_id) {
      authUserId = anyExistingProfile.auth_user_id;
      isLegacyAuth = false; // multi-tenant — fresh UUID profile
    } else {
      // Brand new — auth.admin.createUser
      const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
        email: `bayi_invite_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
        email_confirm: true,
        user_metadata: { name: inv.name },
      });
      if (authErr || !authUser?.user) {
        console.error("[bayi-davet/accept] auth.admin.createUser error:", authErr);
        return NextResponse.json({ error: "Hesap oluşturulamadı." }, { status: 500 });
      }
      authUserId = authUser.user.id;
      isLegacyAuth = true;
    }

    // runTenantSignup ile profile + subscription + active_session
    const handled = await runTenantSignup(sb, {
      authUserId,
      phone: inv.phone,
      name: inv.name,
      tenantKey: "bayi",
      isLegacyAuth,
    });
    if (!handled) {
      return NextResponse.json({ error: "Kayıt akışı başlatılamadı." }, { status: 500 });
    }

    // Yeni bayi profile'ı bul (runTenantSignup içinde oluşturuldu) + metadata
    // güncelle (davet bilgilerini firma_profili'ye yansıt)
    const { data: bayiProfile } = await sb
      .from("profiles")
      .select("id, metadata")
      .eq("auth_user_id", authUserId)
      .eq("tenant_id", bayiCfg.tenantId)
      .maybeSingle();
    if (!bayiProfile) {
      return NextResponse.json({ error: "Bayi profili bulunamadı." }, { status: 500 });
    }

    const existingMeta = (bayiProfile.metadata as Record<string, unknown>) || {};
    const existingFirma = (existingMeta.firma_profili as Record<string, unknown>) || {};
    await sb
      .from("profiles")
      .update({
        metadata: {
          ...existingMeta,
          firma_profili: {
            ...existingFirma,
            ticari_unvan: inv.store_name,
            ofis_adresi: inv.store_address ?? existingFirma.ofis_adresi ?? null,
            vergi_no: inv.tax_no ?? existingFirma.vergi_no ?? null,
            yetkili_adi: inv.name,
          },
        },
      })
      .eq("id", bayiProfile.id);

    // Davet status accepted
    await sb
      .from("dealer_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: bayiProfile.id,
      })
      .eq("id", inv.id);

    // Cookie session attach + redirect URL
    const response = NextResponse.json({
      ok: true,
      redirect: `${APP_URL}/tr/bayi-panel`,
    });
    return await attachSessionToResponse(response, {
      uid: bayiProfile.id,
      tenantId: bayiCfg.tenantId,
    });
  } catch (err) {
    console.error("[bayi-davet/accept]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
