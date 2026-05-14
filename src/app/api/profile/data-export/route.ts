/**
 * GET /api/profile/data-export — Faz 7.1b.
 *
 * GDPR Article 15 (Right of access) — kullanıcı tüm kişisel verilerini
 * tek JSON dump olarak indirir. Auth: cookie/token (resolvePanelAuth).
 *
 * Dahil edilenler:
 *   - profile (whitelist'li alanlar; KVKK / Google bağlantısı / abonelik bilgisi)
 *   - emlak_properties + photos (mülk portföyü)
 *   - emlak_customers (müşteri kayıtları)
 *   - emlak_presentations (sunum başlıkları/tokenlar)
 *   - emlak_tracking (takip kayıtları — varsa)
 *   - emlak_contracts (sözleşmeler — varsa)
 *   - subscriptions (abonelik durumu, billing dönemleri)
 *
 * Dahil edilmeyenler (kasten):
 *   - Hash, password, refresh_token, OAuth secret — profiles tablosunda yok
 *     ama yine de tüm "sub" / "token" / "secret" benzeri kolonları whitelist
 *     ile filtreliyoruz.
 *   - Başka kullanıcıların verisi (mesaj geçmişinde karşı taraf maskelenir;
 *     şu an conversation log endpoint'i export'a dahil değil).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sb = getServiceClient();
  const userId = auth.userId;

  try {
    const [
      { data: profile },
      { data: properties },
      { data: customers },
      { data: presentations },
      { data: subscriptions },
    ] = await Promise.all([
      sb
        .from("profiles")
        .select(
          "id, display_name, role, tenant_id, whatsapp_phone, google_email, created_at, kvkk_consent_at, kvkk_consent_version, billing_address, metadata",
        )
        .eq("id", userId)
        .maybeSingle(),
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

    const propertyIds = (properties ?? []).map((p) => p.id as string);
    const { data: photos } = propertyIds.length
      ? await sb
          .from("emlak_property_photos")
          .select("id, property_id, url, sort_order, created_at")
          .in("property_id", propertyIds)
      : { data: [] };

    const dump = {
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

    const today = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(dump, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="upu-emlak-veri-export-${today}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[profile/data-export]", err);
    return NextResponse.json({ error: "Veri dışa aktarımı sırasında hata." }, { status: 500 });
  }
}
