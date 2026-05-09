/**
 * POST /api/panel-session/qr-claim
 * Body: { code: string, tenant: string }
 *
 * Mobil panel "🖥 Bilgisayardan Aç" → kamera → QR taradıktan sonra çağırılır.
 * Mobil cookie (upu_session) ile auth edilir; cookie yoksa 401.
 *
 * Code'u kullanıcıya bağlar (status='claimed', claimed_user_id, claimed_tenant
 * set). TTL geçmişse 410 Gone döner.
 *
 * Tenant: hangi panel'den taradığı (emlak/bayi/market/otel/restoran).
 * Mobil panel layout'undan biliniyor — claim çağrısında body'de iletilir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies } from "@/platform/auth/session";
import { isValidTenantKey } from "@/platform/auth/qr";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
    }

    let body: { code?: string; tenant?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz body." }, { status: 400 });
    }

    const code = body.code?.trim();
    const tenant = body.tenant?.trim();
    if (!code) return NextResponse.json({ error: "Code gerekli." }, { status: 400 });
    if (!tenant || !isValidTenantKey(tenant)) {
      return NextResponse.json({ error: "Geçersiz tenant." }, { status: 400 });
    }

    const sb = getServiceClient();
    const { data: row } = await sb
      .from("panel_qr_tokens")
      .select("status, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: "QR kod bulunamadı." }, { status: 404 });
    }
    if (row.status !== "pending") {
      return NextResponse.json({ error: "QR kod zaten kullanılmış." }, { status: 410 });
    }
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ error: "QR kodun süresi dolmuş." }, { status: 410 });
    }

    const { error: updErr } = await sb
      .from("panel_qr_tokens")
      .update({
        status: "claimed",
        claimed_user_id: session.uid,
        claimed_tenant: tenant,
        claimed_at: new Date().toISOString(),
      })
      .eq("code", code)
      .eq("status", "pending");
    if (updErr) {
      console.error("[qr-claim] update error:", updErr);
      return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[qr-claim]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
