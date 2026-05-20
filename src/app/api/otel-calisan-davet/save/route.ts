/**
 * POST /api/otel-calisan-davet/save — yeni çalışan profili oluştur,
 * hotel_employees row insert et (per-hotel scope), invite_codes pending
 * ekle, çalışana WA üzerinden kayıt kodu gönder.
 *
 * Body: {
 *   token, name, phone, position?, capabilities: string[], hotel_id?
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { sendButtons } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";
import { OTEL_CAPABILITIES, FORM_VISIBLE_CAPABILITIES } from "@/tenants/otel/capabilities";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_CAPABILITIES = new Set<string>(FORM_VISIBLE_CAPABILITIES);

function normalizePhone(raw: string): string {
  let s = String(raw || "").replace(/\D/g, "");
  if (s.startsWith("0")) s = "90" + s.slice(1);
  return s;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const auth = await requireAuthFromBody(req, body);
    if ("error" in auth) return auth.error;
    const name = String(body.name || "").trim();
    const phoneRaw = String(body.phone || "").trim();
    const position = String(body.position || "").trim();
    const hotelId = body.hotel_id ? String(body.hotel_id) : null;
    const caps = Array.isArray(body.capabilities)
      ? body.capabilities.filter((c: unknown) => typeof c === "string")
      : [];

    if (name.length < 2) return NextResponse.json({ error: "İsim en az 2 karakter olmalı." }, { status: 400 });
    if (phoneRaw.length < 8) return NextResponse.json({ error: "Geçerli telefon numarası gerekli." }, { status: 400 });
    if (caps.length === 0) return NextResponse.json({ error: "En az bir yetki seçmelisiniz." }, { status: 400 });

    const invalid = caps.filter((c: string) => !ALLOWED_CAPABILITIES.has(c));
    if (invalid.length) return NextResponse.json({ error: `Geçersiz yetki: ${invalid.join(", ")}` }, { status: 400 });

    // Sahip yetkisini (EMPLOYEES_MANAGE) çalışana verme — owner-only
    if (caps.includes(OTEL_CAPABILITIES.EMPLOYEES_MANAGE)) {
      return NextResponse.json({ error: "Çalışan yönet yetkisi sadece sahip içindir." }, { status: 400 });
    }

    const phone = normalizePhone(phoneRaw);

    const supabase = getServiceClient();
    const lookup = await resolveTenantProfile<{
      id: string; tenant_id: string; display_name: string | null; whatsapp_phone: string | null;
    }>(supabase, {
      userId: auth.userId,
      tenantKey: "otel",
      select: "id, tenant_id, display_name, whatsapp_phone",
    });
    if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });
    const owner = lookup.profile;

    // hotel_id geldiyse owner'ın o otele bağlı olduğunu doğrula
    if (hotelId) {
      const { data: bind } = await supabase
        .from("otel_user_hotels")
        .select("hotel_id")
        .eq("user_id", owner.id)
        .eq("hotel_id", hotelId)
        .maybeSingle();
      if (!bind) return NextResponse.json({ error: "Bu otel sizinle bağlı değil." }, { status: 403 });
    }

    // Auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: `otel_emp_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
      email_confirm: true,
      user_metadata: { name },
    });
    if (authErr || !authUser.user) {
      console.error("[otel-calisan-davet:save] auth err", authErr);
      return NextResponse.json({ error: "Çalışan oluşturma hatası." }, { status: 500 });
    }

    const inviteCode = randomBytes(3).toString("hex").toUpperCase();

    // Profile (role=employee, capabilities, invited_by, metadata.position)
    const { error: profErr } = await supabase.from("profiles").insert({
      id: authUser.user.id,
      tenant_id: owner.tenant_id,
      display_name: name,
      role: "employee",
      capabilities: caps,
      invited_by: owner.id,
      metadata: { position: position || null },
    });
    if (profErr) {
      console.error("[otel-calisan-davet:save] profile err", profErr);
      return NextResponse.json({ error: "Profil kaydı başarısız." }, { status: 500 });
    }

    // hotel_employees: per-hotel scope için. hotel_id verilmediyse skip —
    // çalışan profile.capabilities (global) ile çalışır, multi-hotel ölçek
    // gerektirmiyor.
    if (hotelId) {
      await supabase.from("hotel_employees").insert({
        hotel_id: hotelId,
        profile_id: authUser.user.id,
        capabilities: caps,
        position: position || null,
      });
    }

    await supabase.from("invite_codes").insert({
      tenant_id: owner.tenant_id,
      user_id: authUser.user.id,
      code: inviteCode,
      status: "pending",
    });

    await supabase.from("subscriptions").insert({
      tenant_id: owner.tenant_id,
      user_id: authUser.user.id,
      plan: "trial",
      status: "active",
    });

    if (auth.magicTokenId) {
      await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", auth.magicTokenId);
    }

    // WA invite to employee
    const ownerLabel = owner.display_name || "Yöneticiniz";
    try {
      await sendButtons(phone,
        `👋 Merhaba ${name}!\n\n${ownerLabel} sizi otel ekibine çalışan olarak ekledi.\n\nKayıt kodunuz: *${inviteCode}*\n\nYetkileriniz: ${caps.length} kalem\n\nBu mesaja kodu yazarak giriş yapabilirsiniz.`,
        [{ id: "cmd:menu", title: "📋 Başla" }],
      );
    } catch (waErr) {
      console.error("[otel-calisan-davet:save] WA invite failed:", waErr);
    }

    if (owner.whatsapp_phone) {
      try {
        await sendButtons(owner.whatsapp_phone,
          `✅ Çalışan davet edildi!\n\n👤 ${name}\n📱 ${phone}\n🔑 ${caps.length} yetki\n\nKayıt kodu çalışana gönderildi.`,
          [
            { id: "cmd:calisanyonet", title: "👥 Çalışanlar" },
            { id: "cmd:menu", title: "Ana Menü" },
          ],
        );
      } catch { /* ignore */ }
    }

    return NextResponse.json({ success: true, inviteCode, employeeId: authUser.user.id });
  } catch (err) {
    console.error("[otel-calisan-davet:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
