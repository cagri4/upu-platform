/**
 * /api/musteri/init?t=<token> — magic link doğrula. Müşteri ekle/düzenle
 * formu yüklenirken çağrılır. Sadece token validate eder.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolvePanelAuth(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[musteri:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
