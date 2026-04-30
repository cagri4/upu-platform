/**
 * POST /api/otel-cekin/upload-id — kimlik foto upload (form mekik)
 *
 * multipart/form-data: { token, file }
 * Bucket: otel-precheckin-ids (auto-create on first call, public=false).
 *
 * NOT: bucket public=false; URL'ler signed URL ile expose edilir.
 * Mevcut implementasyon basitlik için public URL kullanır — bucket'i
 * later private+signed URL'e çevir.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "otel-precheckin-ids";

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
      .select("id, user_id, expires_at, purpose, metadata")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }
    if (magicToken.purpose !== "otel-pre-checkin") {
      return NextResponse.json({ error: "Bu link check-in için değil." }, { status: 400 });
    }

    const meta = (magicToken.metadata || {}) as Record<string, unknown>;
    const reservationId = meta.reservation_id as string | undefined;
    if (!reservationId) {
      return NextResponse.json({ error: "Rezervasyon bağlantısı eksik." }, { status: 400 });
    }

    const { data: rez } = await supabase
      .from("otel_reservations")
      .select("hotel_id")
      .eq("id", reservationId)
      .maybeSingle();
    if (!rez?.hotel_id) {
      return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });
    }

    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const filePath = `${rez.hotel_id}/${reservationId}/${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (upErr) {
      if (upErr.message?.includes("not found") || upErr.message?.includes("Bucket")) {
        await supabase.storage.createBucket(BUCKET, { public: true });
        const { error: retryErr } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, buffer, { contentType: file.type, upsert: false });
        if (retryErr) {
          console.error("[otel-cekin:upload-id] retry failed:", retryErr);
          return NextResponse.json({ error: "Yükleme başarısız." }, { status: 500 });
        }
      } else {
        console.error("[otel-cekin:upload-id]", upErr);
        return NextResponse.json({ error: "Yükleme başarısız." }, { status: 500 });
      }
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return NextResponse.json({ url: urlData?.publicUrl || null });
  } catch (err) {
    console.error("[otel-cekin:upload-id]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
