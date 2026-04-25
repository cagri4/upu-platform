/**
 * /api/profilduzenle/upload-photo — profil fotosu yükle.
 * Storage path: properties/profile/<user_id>/<timestamp>.<ext>
 * (property-photos bucket'ı reuse — mevcut public bucket).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const token = form.get("token");
    const file = form.get("file");

    if (typeof token !== "string" || !token) {
      return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Sadece görsel dosyalar." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Foto 5 MB'dan büyük olamaz." }, { status: 400 });
    }

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

    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const filePath = `profile/${magicToken.user_id}/${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("property-photos")
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (upErr) {
      console.error("[profilduzenle:upload]", upErr);
      return NextResponse.json({ error: "Yükleme başarısız." }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from("property-photos").getPublicUrl(filePath);
    return NextResponse.json({ url: urlData?.publicUrl || null });
  } catch (err) {
    console.error("[profilduzenle:upload]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
