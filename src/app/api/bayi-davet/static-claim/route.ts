/**
 * POST /api/bayi-davet/static-claim
 *
 * Body: { slug, phone, name, store_name?, store_address?, tax_no? }
 *
 * Statik davet linki (`/davet/<slug>`) tıklayan bayinin onboarding flow'u.
 * Anonymous endpoint — slug ile distributor lookup yapar, sonra
 * /api/bayi-davet/accept ile aynı mantığı uygular (mevcut auth.user
 * varsa multi-tenant profile, yoksa auth.admin.createUser + tenant signup).
 *
 * Mevcut dynamic accept flow ile paritetik — sadece dealer_invitations row
 * input yerine slug + form input.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByKey } from "@/tenants/config";
import { runTenantSignup } from "@/platform/whatsapp/organic-signup";
import { attachSessionToResponse } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";

function normalizePhone(input: string): string {
  return input.replace(/[^\d]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    let body: {
      slug?: string;
      phone?: string;
      name?: string;
      store_name?: string;
      store_address?: string;
      tax_no?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }

    const slug = body.slug?.toLowerCase();
    const phone = normalizePhone(body.phone ?? "");
    const name = (body.name ?? "").trim();
    const storeName = (body.store_name ?? "").trim();

    if (!slug) return NextResponse.json({ error: "Slug gerekli." }, { status: 400 });
    if (!/^[0-9]{10,15}$/.test(phone)) {
      return NextResponse.json({ error: "Geçerli bir telefon girin (10-15 hane)." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "İsim soyisim en az 2 karakter." }, { status: 400 });
    }

    const sb = getServiceClient();

    // 1) Slug → distributor lookup
    const { data: slugRow } = await sb
      .from("distributor_slugs")
      .select("slug, distributor_user_id, tenant_id, display_name")
      .eq("slug", slug)
      .maybeSingle();
    if (!slugRow) return NextResponse.json({ error: "Davet bulunamadı." }, { status: 404 });

    const bayiCfg = getTenantByKey("bayi");
    if (!bayiCfg || bayiCfg.tenantId !== slugRow.tenant_id) {
      return NextResponse.json({ error: "Bayi tenant config eşleşmedi." }, { status: 500 });
    }
    const bayiTenantId = bayiCfg.tenantId;

    // 2) Aynı tenant'ta zaten bayi profili var mı?
    const { data: existing } = await sb
      .from("profiles")
      .select("id, auth_user_id")
      .eq("whatsapp_phone", phone)
      .eq("tenant_id", bayiTenantId)
      .maybeSingle();
    if (existing) {
      // Auto-login — mevcut bayi profile'ı, cookie session ver
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

    // 3) auth.user var mı (başka tenant'ta profile)?
    const { data: anyExistingProfile } = await sb
      .from("profiles")
      .select("auth_user_id, id")
      .eq("whatsapp_phone", phone)
      .limit(1)
      .maybeSingle();

    let authUserId: string;
    let isLegacyAuth: boolean;

    if (anyExistingProfile?.auth_user_id) {
      authUserId = anyExistingProfile.auth_user_id;
      isLegacyAuth = false;
    } else {
      const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
        email: `bayi_static_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
        email_confirm: true,
        user_metadata: { name },
      });
      if (authErr || !authUser?.user) {
        console.error("[bayi-davet/static-claim] auth.admin.createUser error:", authErr);
        return NextResponse.json({ error: "Hesap oluşturulamadı." }, { status: 500 });
      }
      authUserId = authUser.user.id;
      isLegacyAuth = true;
    }

    // 4) runTenantSignup ile bayi profile + subscription + active_session
    const handled = await runTenantSignup(sb, {
      authUserId,
      phone,
      name,
      tenantKey: "bayi",
      isLegacyAuth,
    });
    if (!handled) {
      return NextResponse.json({ error: "Kayıt akışı başlatılamadı." }, { status: 500 });
    }

    // 5) Bayi profile metadata güncelle (firma_profili)
    const { data: bayiProfile } = await sb
      .from("profiles")
      .select("id, metadata")
      .eq("auth_user_id", authUserId)
      .eq("tenant_id", bayiTenantId)
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
            ticari_unvan: storeName || existingFirma.ticari_unvan || null,
            ofis_adresi: body.store_address?.trim() || existingFirma.ofis_adresi || null,
            vergi_no: body.tax_no?.trim() || existingFirma.vergi_no || null,
            yetkili_adi: name,
          },
          // İz: hangi dağıtıcı ekledi
          recruited_by: {
            distributor_user_id: slugRow.distributor_user_id,
            slug: slugRow.slug,
            at: new Date().toISOString(),
          },
        },
      })
      .eq("id", bayiProfile.id);

    // 6) dealer_invitations row da düş (audit / dağıtıcı listesi için)
    const inviteCode = randomBytes(4).toString("hex").toUpperCase();
    await sb.from("dealer_invitations").insert({
      distributor_tenant_id: bayiTenantId,
      distributor_user_id: slugRow.distributor_user_id,
      phone,
      name,
      store_name: storeName || "(Statik link)",
      store_address: body.store_address?.trim() || null,
      tax_no: body.tax_no?.trim() || null,
      invite_code: inviteCode,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_user_id: bayiProfile.id,
    });

    const response = NextResponse.json({
      ok: true,
      redirect: `${APP_URL}/tr/bayi-panel`,
    });
    return await attachSessionToResponse(response, {
      uid: bayiProfile.id,
      tenantId: bayiTenantId,
    });
  } catch (err) {
    console.error("[bayi-davet/static-claim]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
