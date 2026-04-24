/**
 * POST /api/bayi-odeme/save — record a payment transaction and update
 * the dealer balance. Owner can record for any dealer; a dealer can
 * record for themselves (e.g. "I just sent a bank transfer").
 *
 * Body: { token, dealer_id, amount, method?, note? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons, sendText } from "@/platform/whatsapp/send";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function fmt(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const dealerId = String(body.dealer_id || "").trim();
    const amount = Number(body.amount || 0);
    const method = String(body.method || "transfer").trim();
    const note = body.note ? String(body.note).trim() : null;

    if (!dealerId) return NextResponse.json({ error: "Bayi seçin." }, { status: 400 });
    if (!(amount > 0)) return NextResponse.json({ error: "Geçerli tutar girin." }, { status: 400 });

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();
    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (magicToken.used_at) return NextResponse.json({ error: "Bu link zaten kullanılmış." }, { status: 400 });
    if (new Date(magicToken.expires_at) < new Date()) return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, tenant_id, role, capabilities, dealer_id, whatsapp_phone, display_name")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const caps = (profile.capabilities as string[] | null) || [];
    const canRecordAny = caps.includes("*") || caps.includes(BAYI_CAPABILITIES.FINANCE_PAYMENTS);
    const isDealer = profile.role === "dealer";
    if (!canRecordAny && !(isDealer && dealerId === profile.dealer_id)) {
      return NextResponse.json({ error: "Ödeme kaydetme yetkiniz yok." }, { status: 403 });
    }

    const { data: dealer } = await supabase
      .from("bayi_dealers")
      .select("id, company_name, balance, user_id")
      .eq("id", dealerId)
      .eq("tenant_id", profile.tenant_id)
      .maybeSingle();
    if (!dealer) return NextResponse.json({ error: "Bayi bulunamadı." }, { status: 404 });

    const { error: txErr } = await supabase.from("bayi_dealer_transactions").insert({
      tenant_id: profile.tenant_id,
      dealer_id: dealer.id,
      type: "payment",
      amount,
      description: note ? `${method} — ${note}` : method,
      created_at: new Date().toISOString(),
    });
    if (txErr) {
      console.error("[bayi-odeme:save] tx err", txErr);
      return NextResponse.json({ error: txErr.message || "Kaydedilemedi." }, { status: 500 });
    }

    // Update balance: payment reduces dealer's debt (balance becomes more positive)
    const newBalance = Number(dealer.balance || 0) + amount;
    await supabase
      .from("bayi_dealers")
      .update({ balance: newBalance })
      .eq("id", dealer.id)
      .eq("tenant_id", profile.tenant_id);

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    // Notify caller
    if (profile.whatsapp_phone) {
      try {
        await sendButtons(profile.whatsapp_phone,
          `✅ Ödeme kaydedildi!\n\n🏪 ${dealer.company_name}\n💰 ${fmt(amount)} ₺\n📝 ${method}${note ? `\n📄 ${note}` : ""}`,
          [
            { id: "cmd:bakiye", title: "💰 Bakiye" },
            { id: "cmd:menu", title: "Ana Menü" },
          ],
        );
      } catch { /* ignore */ }
    }

    // If dealer recorded their own payment, notify owner
    if (isDealer && dealer.user_id !== profile.id) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("whatsapp_phone")
        .eq("tenant_id", profile.tenant_id)
        .contains("capabilities", ["*"])
        .not("whatsapp_phone", "is", null)
        .limit(1)
        .maybeSingle();
      if (ownerProfile?.whatsapp_phone) {
        try {
          await sendText(ownerProfile.whatsapp_phone,
            `💳 ${dealer.company_name} ${fmt(amount)} ₺ ödeme kaydı açtı (${method}).`);
        } catch { /* ignore */ }
      }
    }

    // Event: notify finance-capability peers
    try {
      const { notifyUsersByCapability } = await import("@/platform/cron/notifications");
      await notifyUsersByCapability(
        profile.tenant_id,
        BAYI_CAPABILITIES.FINANCE_INVOICES,
        `💳 Yeni ödeme — ${dealer.company_name} ${fmt(amount)} ₺`,
        { excludeUserId: profile.id },
      );
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true, balance: newBalance });
  } catch (err) {
    console.error("[bayi-odeme:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
