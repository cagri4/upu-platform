/**
 * GET /api/panel-session/qr-status?code=<code>
 *
 * Desktop tarayıcı her 2 sn bu endpoint'i polluyor. Status:
 *   pending  → kullanıcı henüz taramadı, beklemeye devam
 *   claimed  → mobil QR'ı taradı, /qr-finish'e geçilebilir
 *   finished → desktop cookie set edildi, redirect tamamlandı
 *   expired  → 60 sn aşıldı, yeni QR'a yönlendir
 *
 * Sensitive bilgi (user_id vs.) döndürülmez — sadece status.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Code gerekli" }, { status: 400 });
    }

    const sb = getServiceClient();
    const { data: row } = await sb
      .from("panel_qr_tokens")
      .select("status, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (!row) return NextResponse.json({ status: "expired" });

    // TTL geçmişse expired döndür (status hâlâ pending de olsa)
    if (new Date(row.expires_at) < new Date() && row.status === "pending") {
      return NextResponse.json({ status: "expired" });
    }

    return NextResponse.json({ status: row.status });
  } catch (err) {
    console.error("[qr-status]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
