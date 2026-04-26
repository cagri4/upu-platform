/**
 * /api/websayfam/edit-link?slug=<slug> — verilen slug'ın sahibi
 * profile için yeni bir magic link üretir, /tr/profil-duzenle URL'ini
 * döner.
 *
 * Authorization: yok (public landing'den çağrılıyor). Bu açık bir
 * tasarım kararı — kötüye kullanım riski düşük çünkü token yine
 * profile.whatsapp_phone'una bağlı, magic link ile sadece o profilin
 * sahibinin formuna girilebiliyor. Web sayfasını ziyaret eden bir
 * yabancı düzenle butonuna basarsa server token üretir ama o linki
 * sadece WhatsApp'tan ulaşılabilen profil sahibi açtığında işine yarar.
 *
 * (İleride sıkılaştırmak istersek: ?slug=' + cookie/IP eşleştirme.)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "Slug gerekli." }, { status: 400 });

    const supabase = getServiceClient();
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .filter("metadata->agent_profile->>web_slug", "eq", slug)
      .limit(1);

    const profile = profiles?.[0];
    if (!profile) return NextResponse.json({ error: "Sayfa bulunamadı." }, { status: 404 });

    const token = randomBytes(16).toString("hex");
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await supabase.from("magic_link_tokens").insert({
      user_id: profile.id,
      token,
      expires_at: expires,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://estateai.upudev.nl";
    const url = `${appUrl}/tr/profil-duzenle?t=${token}`;

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[websayfam:edit-link]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
