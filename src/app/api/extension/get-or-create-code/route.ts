/**
 * /api/extension/get-or-create-code — Chrome eklentisi bağlantı kodu
 * üretir/getirir.
 *
 * GET → mevcut kullanıcı için varsa kayıtlı extension_tokens row'u
 *       döner. Yoksa oluşturur. Code = full_token[0..6].toUpperCase().
 *
 * POST { regenerate: true } → mevcut row silinir, yenisi üretilir
 *       (kullanıcı eski kodu revoke etmek isterse).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth, resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

function codeFromToken(fullToken: string): string {
  return fullToken.substring(0, 6).toUpperCase();
}

async function ensureToken(userId: string): Promise<{ code: string; token: string }> {
  const sb = getServiceClient();
  const { data: existing } = await sb
    .from("extension_tokens")
    .select("token")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.token) {
    const t = existing.token as string;
    return { code: codeFromToken(t), token: t };
  }
  const newToken = randomBytes(24).toString("hex");
  await sb.from("extension_tokens").insert({ user_id: userId, token: newToken });
  return { code: codeFromToken(newToken), token: newToken };
}

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { code } = await ensureToken(auth.userId);
  return NextResponse.json({ success: true, code });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (body?.regenerate === true) {
      const sb = getServiceClient();
      await sb.from("extension_tokens").delete().eq("user_id", auth.userId);
    }
    const { code } = await ensureToken(auth.userId);
    return NextResponse.json({ success: true, code });
  } catch (err) {
    console.error("[extension:get-or-create-code]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
