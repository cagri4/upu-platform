/**
 * POST /api/tour/advance — web tarafından tour ilerletme.
 *
 * Body: { token, event, tenantKey? }
 *
 * advanceDiscovery'yi server-side çağırır; event mevcut step+1'e map
 * etmiyorsa no-op (false döner). Bu sayede client güvenle "fire-once on
 * mount" yapabilir; tour step zaten ilerlemişse veya event geçersizse
 * sessizce devam eder.
 *
 * Magic-link auth ile owner profile çözülür; whatsapp_phone profile'dan
 * okunur. tenantKey verilmezse default "bayi".
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { token?: string; event?: string; tenantKey?: string };
  try {
    body = await req.json() as { token?: string; event?: string; tenantKey?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { token, event, tenantKey = "bayi" } = body;
  if (!token || !event) return NextResponse.json({ error: "token + event gerekli" }, { status: 400 });

  const supabase = getServiceClient();
  const { data: magicToken } = await supabase
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(magicToken.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, whatsapp_phone")
    .eq("id", magicToken.user_id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

  if (!profile.whatsapp_phone) {
    // Phone yoksa silently no-op — kullanıcıya WA mesaj gönderemeyiz
    return NextResponse.json({ ok: true, advanced: false, reason: "no_phone" });
  }

  try {
    const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
    const advanced = await advanceDiscovery(profile.id, tenantKey, profile.whatsapp_phone, event);
    return NextResponse.json({ ok: true, advanced });
  } catch (err) {
    console.error("[tour:advance]", err);
    return NextResponse.json({ ok: true, advanced: false, error: "advance_failed" });
  }
}
