/**
 * /api/musteri/get?id=<customer_id>
 * Düzenleme formu için tek müşterinin tüm alanlarını döner.
 * Cookie-aware + ownership check.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const { data: customer } = await sb
    .from("emlak_customers")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customer) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
  return NextResponse.json({ customer });
}
