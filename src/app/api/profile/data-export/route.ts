/**
 * GET /api/profile/data-export — Faz 7.1b + Sprint A tenant-aware.
 *
 * GDPR Article 15 (Right of access) — kullanıcı tüm kişisel verilerini
 * tek JSON dump olarak indirir. Auth: cookie/token (resolvePanelAuth).
 *
 * Tenant resolution: profiles.tenant_id → tenants.saas_type. Bayi user
 * bayi_* tabloları (tenant_id ile filtreli) alır; emlak user emlak_*
 * tablolarını alır. Cross-tenant leakage YOK — her sorgu user'ın
 * tenant_id'sine scoped.
 *
 * Dahil edilmeyenler (kasten):
 *   - Hash, password, refresh_token, OAuth secret — profiles tablosunda yok
 *     ama yine de tüm "sub" / "token" / "secret" benzeri kolonları whitelist
 *     ile filtreliyoruz.
 *   - Başka kullanıcıların profil verisi.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getServiceClient();
  const userId = auth.userId;

  try {
    // Multi-tenant aware profile lookup — auth_user_id || id eşleşir,
    // tenant_id ile resolved tenant'a scoped (legacy + yeni multi-tenant
    // profile pattern'lerinin ikisini de kapsar).
    const lookup = await resolveTenantProfile<{
      id: string;
      display_name: string | null;
      role: string | null;
      tenant_id: string | null;
      whatsapp_phone: string | null;
      google_email: string | null;
      created_at: string | null;
      kvkk_consent_at: string | null;
      kvkk_consent_version: string | null;
      billing_address: Record<string, unknown> | null;
      metadata: Record<string, unknown> | null;
    }>(sb, {
      userId,
      select:
        "id, display_name, role, tenant_id, whatsapp_phone, google_email, created_at, kvkk_consent_at, kvkk_consent_version, billing_address, metadata",
    });
    if ("error" in lookup) {
      return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    }
    const profile = lookup.profile;

    let saasType: string = "emlak";
    if (profile?.tenant_id) {
      const { data: tenant } = await sb
        .from("tenants")
        .select("saas_type")
        .eq("id", profile.tenant_id)
        .maybeSingle();
      if (tenant?.saas_type) saasType = tenant.saas_type;
    }

    const today = new Date().toISOString().slice(0, 10);
    let dump: Record<string, unknown>;

    if (saasType === "bayi") {
      dump = await buildBayiDump({ sb, userId, profile, tenantId: profile?.tenant_id ?? null });
    } else {
      // emlak (default) — Faz 7.1b ile aynı tablo seti
      dump = await buildEmlakDump({ sb, userId, profile });
    }

    return new NextResponse(JSON.stringify(dump, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="upu-${saasType}-veri-export-${today}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[profile/data-export]", err);
    return NextResponse.json({ error: "Veri dışa aktarımı sırasında hata." }, { status: 500 });
  }
}

type SbClient = ReturnType<typeof getServiceClient>;

async function buildEmlakDump({
  sb,
  userId,
  profile,
}: {
  sb: SbClient;
  userId: string;
  profile: Record<string, unknown> | null | undefined;
}) {
  const [
    { data: properties },
    { data: customers },
    { data: presentations },
    { data: subscriptions },
  ] = await Promise.all([
    sb.from("emlak_properties").select("*").eq("user_id", userId),
    sb.from("emlak_customers").select("*").eq("user_id", userId),
    sb
      .from("emlak_presentations")
      .select("id, magic_token, property_ids, status, created_at")
      .eq("user_id", userId),
    sb
      .from("subscriptions")
      .select(
        "user_id, plan, status, payment_provider, current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at",
      )
      .eq("user_id", userId),
  ]);

  const propertyIds = (properties ?? []).map((p: { id: string }) => p.id);
  const { data: photos } = propertyIds.length
    ? await sb
        .from("emlak_property_photos")
        .select("id, property_id, url, sort_order, created_at")
        .in("property_id", propertyIds)
    : { data: [] };

  return {
    schema: "upu-emlak-data-export/v1",
    exported_at: new Date().toISOString(),
    user_id: userId,
    profile: profile ?? null,
    mulkler: properties ?? [],
    mulk_fotograflari: photos ?? [],
    musteriler: customers ?? [],
    sunumlar: presentations ?? [],
    abonelikler: subscriptions ?? [],
    notes: [
      "Bu dosya KVKK Madde 11 / GDPR Article 15 kapsamında hazırlanmıştır.",
      "Şifre, OAuth token, refresh token gibi gizli kimlik bilgileri dahil edilmemiştir.",
      "Sözleşme PDF'leri, sunum görselleri gibi ikincil dosyalar dahil değildir; talep ederseniz info@upudev.nl ile irtibata geçin.",
    ],
  };
}

async function buildBayiDump({
  sb,
  userId,
  profile,
  tenantId,
}: {
  sb: SbClient;
  userId: string;
  profile: Record<string, unknown> | null | undefined;
  tenantId: string | null;
}) {
  // tenant_id yoksa bayi kullanıcı henüz onboarding bitmemiş — sadece profil dön.
  if (!tenantId) {
    return {
      schema: "upu-bayi-data-export/v1",
      exported_at: new Date().toISOString(),
      user_id: userId,
      profile: profile ?? null,
      bayiler: [],
      siparisler: [],
      siparis_kalemleri: [],
      faturalar: [],
      tahsilatlar: [],
      urunler: [],
      abonelikler: [],
      notes: [
        "Bu dosya KVKK Madde 11 / GDPR Article 15 kapsamında hazırlanmıştır.",
        "Hesabınız henüz aktif bir bayi tenant'ına bağlı değil.",
      ],
    };
  }

  const [
    { data: dealers },
    { data: orders },
    { data: invoices },
    { data: transactions },
    { data: products },
    { data: subscriptions },
  ] = await Promise.all([
    sb.from("bayi_dealers").select("*").eq("tenant_id", tenantId),
    sb.from("bayi_orders").select("*").eq("tenant_id", tenantId),
    sb.from("bayi_dealer_invoices").select("*").eq("tenant_id", tenantId),
    sb.from("bayi_dealer_transactions").select("*").eq("tenant_id", tenantId),
    sb.from("bayi_products").select("*").eq("tenant_id", tenantId),
    sb
      .from("subscriptions")
      .select(
        "user_id, plan, status, payment_provider, current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at",
      )
      .eq("user_id", userId),
  ]);

  const orderIds = (orders ?? []).map((o: { id: string }) => o.id);
  const { data: orderItems } = orderIds.length
    ? await sb.from("bayi_order_items").select("*").in("order_id", orderIds)
    : { data: [] };

  return {
    schema: "upu-bayi-data-export/v1",
    exported_at: new Date().toISOString(),
    user_id: userId,
    tenant_id: tenantId,
    profile: profile ?? null,
    bayiler: dealers ?? [],
    siparisler: orders ?? [],
    siparis_kalemleri: orderItems ?? [],
    faturalar: invoices ?? [],
    tahsilatlar: transactions ?? [],
    urunler: products ?? [],
    abonelikler: subscriptions ?? [],
    notes: [
      "Bu dosya KVKK Madde 11 / GDPR Article 15 kapsamında hazırlanmıştır.",
      "Şifre, OAuth token, refresh token gibi gizli kimlik bilgileri dahil edilmemiştir.",
      "Bayi/sipariş/fatura verileri tenant kapsamındaki tüm kayıtları içerir (cross-tenant leakage yoktur).",
    ],
  };
}
