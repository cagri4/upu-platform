/**
 * /api/profilduzenle/upload-photo — profil fotosu yükle.
 * Storage path: properties/profile/<user_id>/<timestamp>.<ext>
 * (property-photos bucket'ı reuse — mevcut public bucket).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { randomBytes } from "crypto";
import { getTenantByDomain } from "@/tenants/config";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    // Defense-in-depth: emlak-only (sister endpoint init/save guard'ı ile aynı).
    const host = req.headers.get("host") || "";
    const tenantKey = getTenantByDomain(host)?.key || null;
    if (tenantKey !== "emlak") {
      return NextResponse.json(
        { error: `Profil foto yükleme yalnız emlak SaaS'ında aktif (tenant: ${tenantKey || "unknown"}).` },
        { status: 403 },
      );
    }

    const form = await req.formData();
    const tokenField = form.get("token");
    const file = form.get("file");
    const token = typeof tokenField === "string" ? tokenField : "";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Sadece görsel dosyalar." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Foto 5 MB'dan büyük olamaz." }, { status: 400 });
    }

    const auth = await resolvePanelAuthFromBody(req, { token });
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const filePath = `profile/${auth.userId}/${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
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
