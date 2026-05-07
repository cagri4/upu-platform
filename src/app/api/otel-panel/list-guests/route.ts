/**
 * /api/otel-panel/list-guests — lifetime misafir listesi (role='guest'
 * profilleri). Tenant scope (owner'ın tenant'ı).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
  }

  const { data: owner } = await sb.from("profiles").select("tenant_id").eq("id", pt.user_id).maybeSingle();
  if (!owner?.tenant_id) return NextResponse.json({ success: true, guests: [] });

  const { data: guests } = await sb
    .from("profiles")
    .select("id, display_name, whatsapp_phone, metadata, created_at")
    .eq("tenant_id", owner.tenant_id)
    .eq("role", "guest")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ success: true, guests: guests || [] });
}
