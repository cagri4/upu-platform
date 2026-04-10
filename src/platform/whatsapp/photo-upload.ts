/**
 * Photo Upload Handler — receive WhatsApp images and store in Supabase.
 *
 * Flow:
 *   1. User enters foto_upload session via /fotograf → mülk seçimi
 *   2. System says "Fotoğraf gönderin"
 *   3. User sends image(s) → this handler processes each
 *   4. User types "bitti" or "tamam" → session ends
 *
 * Pipeline: WhatsApp media_id → Meta Graph API → download binary →
 * Supabase Storage upload → emlak_property_photos insert
 */
import type { WaContext } from "./types";
import type { CommandSession } from "./session";
import { endSession } from "./session";
import { sendText, sendButtons } from "./send";
import { getServiceClient } from "@/platform/auth/supabase";

const WA_API = "https://graph.facebook.com/v23.0";

// ── Download image from WhatsApp via Meta Graph API ─────────────────

async function downloadWhatsAppMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return null;

  try {
    // Step 1: Get media URL
    const metaRes = await fetch(`${WA_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.error("[photo-upload] meta fetch failed:", metaRes.status);
      return null;
    }
    const metaData = await metaRes.json() as { url: string; mime_type: string };

    // Step 2: Download binary from the URL
    const imgRes = await fetch(metaData.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!imgRes.ok) {
      console.error("[photo-upload] image download failed:", imgRes.status);
      return null;
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: metaData.mime_type || "image/jpeg",
    };
  } catch (err) {
    console.error("[photo-upload] download error:", err);
    return null;
  }
}

// ── Upload to Supabase Storage ──────────────────────────────────────

async function uploadToStorage(
  buffer: Buffer,
  mimeType: string,
  propertyId: string,
  photoIndex: number,
): Promise<string | null> {
  const supabase = getServiceClient();
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const filePath = `properties/${propertyId}/${Date.now()}_${photoIndex}.${ext}`;

  const { error } = await supabase.storage
    .from("property-photos")
    .upload(filePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    // Bucket might not exist — try creating it
    if (error.message?.includes("not found") || error.message?.includes("Bucket")) {
      await supabase.storage.createBucket("property-photos", { public: true });
      const { error: retryErr } = await supabase.storage
        .from("property-photos")
        .upload(filePath, buffer, { contentType: mimeType, upsert: false });
      if (retryErr) {
        console.error("[photo-upload] retry upload error:", retryErr);
        return null;
      }
    } else {
      console.error("[photo-upload] upload error:", error);
      return null;
    }
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from("property-photos").getPublicUrl(filePath);
  return urlData?.publicUrl || null;
}

// ── Main handler ────────────────────────────────────────────────────

export async function handlePhotoUpload(
  ctx: WaContext,
  mediaId: string,
  session: CommandSession,
): Promise<void> {
  const supabase = getServiceClient();
  const propertyId = (session.data as Record<string, unknown>)?.propertyId as string;

  if (!propertyId) {
    await sendText(ctx.phone, "❌ Mülk bilgisi bulunamadı. /fotograf komutunu tekrar çalıştırın.");
    await endSession(ctx.userId);
    return;
  }

  // Check current photo count
  const { count } = await supabase
    .from("emlak_property_photos")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  const currentCount = count || 0;
  if (currentCount >= 15) {
    await sendButtons(ctx.phone, "📷 Maksimum 15 fotoğraf limiti doldu.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    await endSession(ctx.userId);
    return;
  }

  // Download from WhatsApp (no "yükleniyor" spam — just process silently)
  const media = await downloadWhatsAppMedia(mediaId);
  if (!media) {
    await sendText(ctx.phone, "❌ Fotoğraf indirilemedi. Tekrar gönderin.");
    return;
  }

  // Upload to storage
  const photoUrl = await uploadToStorage(media.buffer, media.mimeType, propertyId, currentCount + 1);
  if (!photoUrl) {
    await sendText(ctx.phone, "❌ Fotoğraf yüklenemedi. Tekrar gönderin.");
    return;
  }

  // Save to DB
  await supabase.from("emlak_property_photos").insert({
    property_id: propertyId,
    user_id: ctx.userId,
    url: photoUrl,
    sort_order: currentCount + 1,
  });

  // Silent accept — no per-photo confirmation message.
  // When multiple photos arrive in parallel (WhatsApp sends each as a
  // separate webhook call), sending individual "eklendi" messages causes
  // race-condition counts and message spam. Instead, we acknowledge
  // silently and let the user click "Bitti" to see the total.
  //
  // Only send a message if we hit the 15-photo limit.
  const { count: actualCount } = await supabase
    .from("emlak_property_photos")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  if ((actualCount || 0) >= 15) {
    await sendButtons(ctx.phone,
      `✅ ${actualCount} fotoğraf yüklendi! Maksimum limite ulaştınız.`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
    await endSession(ctx.userId);

    // Gamification trigger
    try {
      const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
      await triggerMissionCheck(ctx.userId, ctx.tenantKey, "mulk_foto_uploaded", ctx.phone);
    } catch { /* don't break */ }
  }
  // Otherwise: silent. User sends more or clicks "Bitti".
}
