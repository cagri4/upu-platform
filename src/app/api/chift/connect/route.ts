/**
 * GET /api/chift/connect — Chift hosted-flow URL'i üretir.
 *
 * Akış:
 *   1. Kullanıcı bayi-profil form'undan accounting=yuki seçti
 *   2. UI "Yuki'ye Bağlan" butonu basar → bu endpoint
 *   3. Bu endpoint Chift API'den hosted-flow URL alır (kullanıcının
 *      Yuki/Exact/SnelStart'a OAuth ile yetki verebileceği link)
 *   4. Kullanıcı yönlendirilir, OAuth tamamlanınca Chift webhook bizim
 *      /api/chift/webhook'una POST eder → connection_id kaydedilir
 *   5. Adapter resolver bu connection_id ile API çağırır
 *
 * MVP: gerçek Chift API binding env-var (CHIFT_API_KEY) yoksa 503 döner
 * — UI "Henüz hazır değil, manuel kullanmaya devam edin" mesajı gösterir.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

const CHIFT_API_BASE = "https://api.chift.eu";

export async function GET(req: NextRequest) {
  const integration = req.nextUrl.searchParams.get("integration"); // yuki | exact | snelstart

  if (!integration || !["yuki", "exact", "snelstart"].includes(integration)) {
    return NextResponse.json({ error: "Geçersiz entegrasyon (yuki|exact|snelstart)." }, { status: 400 });
  }

  const apiKey = process.env.CHIFT_API_KEY;
  const accountId = process.env.CHIFT_ACCOUNT_ID;
  if (!apiKey || !accountId) {
    return NextResponse.json({
      error: "Chift entegrasyonu henüz yapılandırılmadı. Manuel kullanıma devam edebilirsiniz.",
      stub: true,
    }, { status: 503 });
  }

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  // Chift integration_key map (Chift dokümana göre normalize)
  const integrationKey = integration === "yuki" ? "yuki"
    : integration === "exact" ? "exact_online"
    : "snelstart";

  try {
    const callbackUrl = `${req.nextUrl.origin}/api/chift/webhook`;
    const res = await fetch(`${CHIFT_API_BASE}/connections/connect`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "X-Account-Id": accountId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        integration_key: integrationKey,
        consumer_id: auth.userId,           // Chift consumer = bizim user
        return_url: `${req.nextUrl.origin}/tr/bayi-profil?chift=connected`,
        webhook_url: callbackUrl,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[chift:connect]", res.status, errText);
      return NextResponse.json({ error: "Chift bağlantı başlatılamadı." }, { status: 500 });
    }
    const data = await res.json() as { url: string };

    return NextResponse.json({ success: true, redirectUrl: data.url });
  } catch (err) {
    console.error("[chift:connect]", err);
    return NextResponse.json({ error: "Chift bağlantı hatası." }, { status: 500 });
  }
}
