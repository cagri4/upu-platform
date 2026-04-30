/**
 * POST /api/bayi-calisan-davet/save — create the employee profile with
 * exactly the capabilities the owner picked, then fire a WhatsApp
 * invite to the employee's phone. Magic-link token invalidated on
 * success so the form is single-use.
 *
 * Body: { token, name, phone, position?, capabilities: string[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_CAPABILITIES = new Set<string>(Object.values(BAYI_CAPABILITIES));

function normalizePhone(raw: string): string {
  // Strip everything non-digit; WhatsApp expects no leading "+"
  let s = String(raw || "").replace(/\D/g, "");
  if (s.startsWith("0")) s = "90" + s.slice(1); // TR leading 0 → 90
  return s;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    const name = String(body.name || "").trim();
    const phoneRaw = String(body.phone || "").trim();
    const position = String(body.position || "").trim();
    const caps = Array.isArray(body.capabilities) ? body.capabilities.filter((c: unknown) => typeof c === "string") : [];

    if (!token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
    if (name.length < 2) return NextResponse.json({ error: "İsim en az 2 karakter olmalı." }, { status: 400 });
    if (phoneRaw.length < 8) return NextResponse.json({ error: "Geçerli telefon numarası gerekli." }, { status: 400 });
    if (caps.length === 0) return NextResponse.json({ error: "En az bir yetki seçmelisiniz." }, { status: 400 });

    // Only capabilities from our registry are accepted. Wildcard "*" is
    // rejected — only owners get wildcard, and owners already exist.
    const invalid = caps.filter((c: string) => !ALLOWED_CAPABILITIES.has(c));
    if (invalid.length) return NextResponse.json({ error: `Geçersiz yetki: ${invalid.join(", ")}` }, { status: 400 });

    const phone = normalizePhone(phoneRaw);

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });

    const { data: owner } = await supabase
      .from("profiles")
      .select("id, tenant_id, display_name, whatsapp_phone")
      .eq("id", magicToken.user_id)
      .single();
    if (!owner?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    // Aşama 6 — Tier quota check: Starter 3 / Growth 10 / Pro sınırsız
    const { canAddEmployee } = await import("@/tenants/bayi/billing/tier-features");
    const quota = await canAddEmployee(owner.id);
    if (!quota.allowed) {
      const nextTier = quota.tier === "starter" ? "Growth" : "Pro";
      return NextResponse.json({
        error: `${quota.tier === "starter" ? "Starter" : "Growth"} paketi ${quota.limit} çalışan limitine ulaştı (${quota.current} aktif). ${nextTier} paketine yükseltin.`,
        tier: quota.tier,
        limit: quota.limit,
        current: quota.current,
        upgrade_to: nextTier.toLowerCase(),
      }, { status: 403 });
    }

    // Create auth user (placeholder email, same pattern as old invite flow)
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: `emp_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
      email_confirm: true,
      user_metadata: { name },
    });
    if (authErr || !authUser.user) {
      console.error("[bayi-calisan-davet:save] auth err", authErr);
      return NextResponse.json({ error: "Çalışan oluşturma hatası." }, { status: 500 });
    }

    const inviteCode = randomBytes(3).toString("hex").toUpperCase();

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
      console.error("[bayi-calisan-davet:save] profile err", profErr);
      return NextResponse.json({ error: "Profil kaydı başarısız." }, { status: 500 });
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

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    // Fire invite to employee's WhatsApp with the join code. The
    // employee replies with the code and their profile resolves via
    // the same invite_codes flow the old implementation used.
    const ownerLabel = owner.display_name || "Yöneticiniz";
    try {
      await sendButtons(phone,
        `👋 Merhaba ${name}!\n\n${ownerLabel} sizi UPU platformuna çalışan olarak ekledi.\n\nKayıt kodunuz: *${inviteCode}*\n\nYetkileriniz: ${caps.length} kalem\n\nBu mesaja kodu yazarak giriş yapabilirsiniz.`,
        [{ id: "cmd:menu", title: "📋 Başla" }],
      );
    } catch (waErr) {
      console.error("[bayi-calisan-davet:save] WA invite failed:", waErr);
    }

    // Notify owner too so they see it worked end-to-end
    if (owner.whatsapp_phone) {
      try {
        await sendButtons(owner.whatsapp_phone,
          `✅ Çalışan davet edildi!\n\n👤 ${name}\n📱 ${phone}\n🔑 ${caps.length} yetki\n\nKayıt kodu ${ownerLabel === "Yöneticiniz" ? "" : "çalışana "}gönderildi.`,
          [
            { id: "cmd:calisanyonet", title: "👥 Çalışanlar" },
            { id: "cmd:menu", title: "Ana Menü" },
          ],
        );
      } catch { /* ignore */ }
    }

    return NextResponse.json({ success: true, inviteCode, employeeId: authUser.user.id });
  } catch (err) {
    console.error("[bayi-calisan-davet:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
