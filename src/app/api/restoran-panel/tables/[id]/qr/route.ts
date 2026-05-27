/**
 * GET /api/restoran-panel/tables/[id]/qr?t=<token>&format=png|svg
 *
 * Bir masa için QR kod üretir. QR içeriği:
 *   https://restoranai.upudev.nl/tr/r/{slug}/m/{qr_token}
 *
 * Müşteri QR'ı tararayınca masa-aware menü sayfasına gider.
 *
 * Format:
 *   - png (default) — image/png, 512×512, error correction M
 *   - svg          — image/svg+xml (yazdırılabilir vektör)
 *
 * Auth: magic token, tenant_id eşleşmesi şart.
 * Brand renkli QR opsiyonu (V2 — şu an siyah/beyaz).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL_RESTORAN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://restoranai.upudev.nl"
  );
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: tableId } = await ctx.params;
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    const format = (req.nextUrl.searchParams.get("format") || "png").toLowerCase();

    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
    if (format !== "png" && format !== "svg") {
      return NextResponse.json({ error: "Format png|svg olmalı." }, { status: 400 });
    }

    const sb = getServiceClient();

    // Token doğrula
    const { data: magicToken } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("tenant_id")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });

    // Masa + restoran lookup (tenant-aware)
    const { data: table } = await sb
      .from("rst_tables")
      .select("id, label, qr_token, restaurant_id, tenant_id")
      .eq("id", tableId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!table) return NextResponse.json({ error: "Masa bulunamadı." }, { status: 404 });
    if (!table.qr_token) {
      return NextResponse.json({ error: "QR token eksik. Migration uygulandı mı?" }, { status: 500 });
    }

    // Restoran slug
    const { data: rest } = await sb
      .from("rst_restaurants")
      .select("slug, brand_name")
      .eq("id", table.restaurant_id)
      .maybeSingle();
    if (!rest) {
      return NextResponse.json({ error: "Restoran kartı yok. Profil formunu doldurun." }, { status: 404 });
    }

    const qrUrl = `${getAppUrl()}/tr/r/${rest.slug}/m/${table.qr_token}`;

    if (format === "svg") {
      const svg = await QRCode.toString(qrUrl, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
        width: 512,
      });
      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml",
          "Content-Disposition": `inline; filename="masa-${table.label}-qr.svg"`,
          "Cache-Control": "private, max-age=86400",
        },
      });
    }

    // PNG (default)
    const buf = await QRCode.toBuffer(qrUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      width: 512,
    });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="masa-${table.label}-qr.png"`,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[restoran-panel/tables/qr]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
