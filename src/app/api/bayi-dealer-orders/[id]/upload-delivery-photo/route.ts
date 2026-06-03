/**
 * POST /api/bayi-dealer-orders/[id]/upload-delivery-photo — multipart/form-data file
 *
 * Sevkiyat #6.3: teslim edildiğinde opsiyonel imza/foto kanıtı.
 * Bucket: bayi-deliveries (private; signed URL 7g) — first call auto-create.
 * Yol: <tenantId>/<orderId>/<ts>_<rand>.<ext>
 *
 * Frontend signed URL'i alıp update-shipment'a `delivered_photo_url` olarak yollar.
 * (Burada DB'ye yazmıyoruz — atomik kontrol update-shipment'ta.)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { hasCapability, BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const SIGNED_TTL_SEC = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const host = req.headers.get("host") || "";
  if (getTenantByDomain(host)?.key !== "bayi") {
    return NextResponse.json({ error: "Yalnızca bayi subdomain'inde." }, { status: 400 });
  }
  const { id } = await params;

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ role: string | null; capabilities: string[] | null }>(sb, {
    userId: auth.userId,
    tenantKey: "bayi",
    select: "id, role, capabilities",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const role = lookup.profile.role || "";
  const caps = lookup.profile.capabilities || [];
  const allowed = ["admin", "satis", "depocu"].includes(role)
    || hasCapability(caps, BAYI_CAPABILITIES.DEALER_SHIPMENT_UPDATE);
  if (!allowed) {
    return NextResponse.json({ error: "Sevkiyat güncelleme yetkiniz yok." }, { status: 403 });
  }

  const { data: order } = await sb
    .from("bayi_dealer_orders")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", lookup.tenantId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });

  let file: File;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (!(f instanceof File)) {
      return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });
    }
    file = f;
  } catch {
    return NextResponse.json({ error: "FormData okunamadı." }, { status: 400 });
  }

  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Sadece JPG, PNG, WEBP yüklenebilir." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fotoğraf 8 MB'dan büyük olamaz." }, { status: 400 });
  }

  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const filePath = `${lookup.tenantId}/${id}/${Date.now()}_${randomBytes(4).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const tryUpload = () => sb.storage
    .from("bayi-deliveries")
    .upload(filePath, buffer, { contentType: file.type, upsert: false });

  let { error: upErr } = await tryUpload();
  if (upErr && (upErr.message?.includes("not found") || upErr.message?.includes("Bucket"))) {
    await sb.storage.createBucket("bayi-deliveries", { public: false });
    ({ error: upErr } = await tryUpload());
  }
  if (upErr) {
    console.error("[upload-delivery-photo]", upErr);
    return NextResponse.json({ error: "Yükleme başarısız." }, { status: 500 });
  }

  const { data: signed } = await sb.storage
    .from("bayi-deliveries")
    .createSignedUrl(filePath, SIGNED_TTL_SEC);

  return NextResponse.json({
    ok: true,
    path: filePath,
    url: signed?.signedUrl || null,
  });
}
