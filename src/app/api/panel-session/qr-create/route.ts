/**
 * POST /api/panel-session/qr-create
 *
 * Desktop'tan açılan qr-giris sayfasından çağrılır. Tek kullanımlık QR token
 * üretir, DB'ye yazar, döndürür. 60 sn TTL.
 *
 * Auth gerekmez (public) — QR'ı tarayan mobil cihazın claim aşamasında
 * kendi cookie'sini kullanması güvenlik katmanını sağlar.
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { generateQrCode, QR_TTL_SECONDS } from "@/platform/auth/qr";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const code = generateQrCode();
    const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000).toISOString();

    const sb = getServiceClient();
    const { error } = await sb.from("panel_qr_tokens").insert({
      code,
      status: "pending",
      expires_at: expiresAt,
    });
    if (error) {
      console.error("[qr-create] insert error:", error);
      return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      code,
      ttlSeconds: QR_TTL_SECONDS,
    });
  } catch (err) {
    console.error("[qr-create]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
