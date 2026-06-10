/**
 * GET /api/bayi/takip/[no] — kargo takip bilgisi (kendi takip sayfamız).
 *
 * Audit 2026-06-10 P0 #5: mock takip no'ları gerçek kargo sitelerine
 * yönleniyordu → sonsuz 404. Bayi artık /tr/bayi/takip/[no] iç sayfasını
 * görür; gerçek kargo sözleşmesi yapılınca canlı API status'u buradan döner.
 *
 * Dealer-scope: takip no yalnızca kendi siparişine aitse görünür.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../../_auth";
import { getIntegrationSetting } from "@/platform/integrations/tenant-settings";

export const dynamic = "force-dynamic";

const CARRIER_LABELS: Record<string, string> = {
  aras: "Aras Kargo",
  yurtici: "Yurtiçi Kargo",
  mng: "MNG Kargo",
};

const CARRIER_EXTERNAL_URL: Record<string, (no: string) => string> = {
  aras: (no) => `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${no}`,
  yurtici: (no) =>
    `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${no}`,
  mng: (no) => `https://service.mngkargo.com.tr/track/${no}`,
};

interface RouteParams {
  params: Promise<{ no: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId, userId } = auth;
  const { no } = await params;

  const trackingNo = (no || "").trim();
  if (!trackingNo) {
    return NextResponse.json({ error: "Takip no gerekli." }, { status: 400 });
  }

  // Dealer guard
  const { data: dealer } = await sb
    .from("bayi_dealers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!dealer) {
    return NextResponse.json({ error: "Bayi hesabı yok." }, { status: 400 });
  }

  const { data: order } = await sb
    .from("bayi_orders")
    .select(
      "id, order_number, dealer_id, shipment_carrier, shipment_tracking_no, shipment_status, shipped_at, status",
    )
    .eq("tenant_id", tenantId)
    .eq("shipment_tracking_no", trackingNo)
    .maybeSingle();

  if (!order || order.dealer_id !== dealer.id) {
    return NextResponse.json({ error: "Takip kaydı bulunamadı." }, { status: 404 });
  }

  const carrier = (order.shipment_carrier as string) || null;

  // Carrier entegrasyonu aktif mi? Değilse takip no mock üretimdir —
  // sayfada açıkça belirtilir, dış site linki yanıltmasın.
  let mocked = true;
  if (carrier) {
    const setting = await getIntegrationSetting(sb, tenantId, carrier);
    mocked = !setting || !setting.isActive;
  }

  return NextResponse.json({
    success: true,
    tracking: {
      trackingNo,
      carrier,
      carrierLabel: carrier ? CARRIER_LABELS[carrier] || carrier : null,
      externalUrl:
        carrier && CARRIER_EXTERNAL_URL[carrier]
          ? CARRIER_EXTERNAL_URL[carrier](trackingNo)
          : null,
      shipmentStatus: (order.shipment_status as string) || null,
      shippedAt: (order.shipped_at as string) || null,
      orderId: order.id as string,
      orderNumber: order.order_number as string,
      orderStatus: (order.status as string) || null,
      mocked,
    },
  });
}
