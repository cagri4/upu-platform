/**
 * POST /api/bayi-davet/create
 *
 * Dağıtıcı panel formundan controlled bayi davet oluşturur. dealer_invitations
 * tablosuna satır + paylaş şablonu (mesaj + accept_url) döner. Bot otomatik
 * WA göndermez — WA Cloud API 24-saat customer service window kuralı:
 * bayi bot'a hiç yazmadıysa freeform mesaj silent drop. Dağıtıcı paylaş
 * butonlarıyla (WhatsApp / SMS / Kopyala) linki kendi iletişiminden gönderir.
 *
 * Body: { phone, name, store_name, store_address?, tax_no?, note? }
 *
 * Auth: subdomain bayi + cookie session (resolvePanelAuth) + admin/user role.
 * Multi-tenant safe: profile.id → auth_user_id → bayi profile lookup.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { getTenantByDomain, getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://retailai.upudev.nl";

function normalizePhone(input: string): string {
  return input.replace(/[^\d]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get("host") || "";
    const hostTenant = getTenantByDomain(host);
    if (hostTenant?.key !== "bayi") {
      return NextResponse.json({ error: "Bu endpoint yalnızca bayi subdomain'inde kullanılır." }, { status: 400 });
    }

    const bayiCfg = getTenantByKey("bayi");
    if (!bayiCfg) {
      return NextResponse.json({ error: "Bayi tenant config bulunamadı." }, { status: 500 });
    }
    const bayiTenantId = bayiCfg.tenantId;

    const auth = await resolvePanelAuth(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const sb = getServiceClient();
    const { data: ownProfile } = await sb
      .from("profiles")
      .select("auth_user_id, display_name")
      .eq("id", auth.userId)
      .maybeSingle();
    const authUserId = ownProfile?.auth_user_id || auth.userId;

    const { data: distributorProfile } = await sb
      .from("profiles")
      .select("id, role, display_name, metadata")
      .eq("auth_user_id", authUserId)
      .eq("tenant_id", bayiTenantId)
      .maybeSingle();
    if (!distributorProfile) {
      return NextResponse.json({ error: "Bayi tenant'a kayıtlı değilsiniz." }, { status: 403 });
    }
    if (distributorProfile.role !== "admin" && distributorProfile.role !== "user") {
      return NextResponse.json({ error: "Sadece firma sahibi bayi davet edebilir." }, { status: 403 });
    }

    let body: {
      phone?: string;
      name?: string;
      store_name?: string;
      store_address?: string;
      tax_no?: string;
      note?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }

    const phone = normalizePhone(body.phone ?? "");
    const name = (body.name ?? "").trim();
    const storeName = (body.store_name ?? "").trim();

    if (!/^[0-9]{10,15}$/.test(phone)) {
      return NextResponse.json({ error: "Geçerli bir telefon numarası girin (10-15 hane)." }, { status: 400 });
    }
    if (name.length < 2) {
      return NextResponse.json({ error: "İsim soyisim en az 2 karakter olmalı." }, { status: 400 });
    }
    if (storeName.length < 2) {
      return NextResponse.json({ error: "Mağaza adı en az 2 karakter olmalı." }, { status: 400 });
    }

    // Aynı tenant'ta zaten bayi profili var mı?
    const { data: existingProfile } = await sb
      .from("profiles")
      .select("id")
      .eq("whatsapp_phone", phone)
      .eq("tenant_id", bayiTenantId)
      .maybeSingle();
    if (existingProfile) {
      return NextResponse.json({ error: "Bu telefon zaten bayi olarak kayıtlı." }, { status: 409 });
    }

    // Aktif bekleyen davet var mı?
    const { data: pending } = await sb
      .from("dealer_invitations")
      .select("id, invite_code")
      .eq("distributor_tenant_id", bayiTenantId)
      .eq("phone", phone)
      .eq("status", "pending")
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();
    if (pending) {
      return NextResponse.json({ error: "Bu telefon için zaten aktif bir davet var." }, { status: 409 });
    }

    const inviteCode = randomBytes(4).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invitation, error: insertErr } = await sb
      .from("dealer_invitations")
      .insert({
        distributor_tenant_id: bayiTenantId,
        distributor_user_id: distributorProfile.id,
        phone,
        name,
        store_name: storeName,
        store_address: body.store_address?.trim() || null,
        tax_no: body.tax_no?.trim() || null,
        note: body.note?.trim() || null,
        invite_code: inviteCode,
        expires_at: expiresAt,
        status: "pending",
      })
      .select("id, invite_code")
      .single();

    if (insertErr || !invitation) {
      console.error("[bayi-davet/create] insert error:", insertErr);
      return NextResponse.json({ error: "Davet oluşturulamadı." }, { status: 500 });
    }

    // Paylaş şablonu — dağıtıcı kendi WA/SMS'inden bayiye iletecek.
    const distributorName =
      (distributorProfile.metadata as Record<string, unknown> | null)?.firma_profili
        ? ((distributorProfile.metadata as { firma_profili?: { ticari_unvan?: string } }).firma_profili?.ticari_unvan as string) || distributorProfile.display_name || "Dağıtıcınız"
        : distributorProfile.display_name || "Dağıtıcınız";

    const acceptUrl = `${APP_URL}/davet/${inviteCode}`;
    const shareMessage =
      `Merhaba ${name}, ${distributorName} sizi UPU sistemine davet etti. ` +
      `Mağaza: ${storeName}. Hesabınızı aktifleştirmek için: ${acceptUrl} (7 gün geçerli).`;

    return NextResponse.json({
      ok: true,
      invite_id: invitation.id,
      invite_code: invitation.invite_code,
      accept_url: acceptUrl,
      share_message: shareMessage,
      share_phone: phone,
      distributor_name: distributorName,
    });
  } catch (err) {
    console.error("[bayi-davet/create]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
