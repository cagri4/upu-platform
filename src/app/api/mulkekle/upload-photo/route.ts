/**
 * /api/mulkekle/upload-photo — upload a single photo to Supabase storage
 * during mülk ekle form fill. Client uploads per file; final save route
 * receives the resulting URLs as `photo_urls` array.
 *
 * Token is validated but NOT marked used_at — only the main save does that.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per photo
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

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
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Sadece JPG, PNG, WEBP yüklenebilir." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Fotoğraf 8 MB'dan büyük olamaz." }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }

    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const filePath = `properties/pending/${magicToken.user_id}/${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from("property-photos")
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (upErr) {
      if (upErr.message?.includes("not found") || upErr.message?.includes("Bucket")) {
        await supabase.storage.createBucket("property-photos", { public: true });
        const { error: retryErr } = await supabase.storage
          .from("property-photos")
          .upload(filePath, buffer, { contentType: file.type, upsert: false });
        if (retryErr) {
          console.error("[mulkekle:upload-photo] retry failed:", retryErr);
          return NextResponse.json({ error: "Yükleme başarısız." }, { status: 500 });
        }
      } else {
        console.error("[mulkekle:upload-photo]", upErr);
        return NextResponse.json({ error: "Yükleme başarısız." }, { status: 500 });
      }
    }

    const { data: urlData } = supabase.storage.from("property-photos").getPublicUrl(filePath);
    return NextResponse.json({ url: urlData?.publicUrl || null });
  } catch (err) {
    console.error("[mulkekle:upload-photo]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
