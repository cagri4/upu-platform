/**
 * GET /api/bayi/profil — profil bilgileri + Google bağlı mı.
 * PUT /api/bayi/profil — display_name + email + briefing_enabled güncelle.
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, userId, profileId } = auth;

  const { data: profile } = await sb
    .from("profiles")
    .select(
      "id, display_name, whatsapp_phone, email_verified, metadata, created_at, role",
    )
    .eq("id", profileId)
    .maybeSingle();

  const metadata = (profile?.metadata as Record<string, unknown>) || {};
  const email = (metadata.email as string) || null;
  const briefingEnabled = !!metadata.briefing_enabled;
  const googleLinked = !!metadata.google_email || !!metadata.google_id;
  const googleEmail = (metadata.google_email as string) || null;

  return NextResponse.json({
    success: true,
    profile: {
      id: profileId,
      userId,
      displayName: (profile?.display_name as string) || "",
      whatsappPhone: (profile?.whatsapp_phone as string) || "",
      email,
      role: (profile?.role as string) || "user",
      briefingEnabled,
      googleLinked,
      googleEmail,
      createdAt: (profile?.created_at as string) || null,
    },
  });
}

interface UpdateBody {
  display_name?: string;
  email?: string | null;
  briefing_enabled?: boolean;
}

export async function PUT(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, profileId } = auth;

  const body = (await req.json().catch(() => ({}))) as UpdateBody;

  const { data: existing } = await sb
    .from("profiles")
    .select("metadata")
    .eq("id", profileId)
    .maybeSingle();
  const base = (existing?.metadata as Record<string, unknown>) || {};
  const newMetadata: Record<string, unknown> = { ...base };

  if (body.email !== undefined) {
    newMetadata.email = body.email?.trim() || null;
  }
  if (body.briefing_enabled !== undefined) {
    newMetadata.briefing_enabled = Boolean(body.briefing_enabled);
  }

  const update: Record<string, unknown> = {
    metadata: newMetadata,
  };
  if (body.display_name !== undefined) {
    const name = body.display_name.trim();
    if (name.length < 2) {
      return NextResponse.json({ error: "Ad soyad en az 2 karakter." }, { status: 400 });
    }
    update.display_name = name;
  }

  const { error } = await sb
    .from("profiles")
    .update(update)
    .eq("id", profileId);

  if (error) {
    console.error("[bayi:profil:update]", error);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
