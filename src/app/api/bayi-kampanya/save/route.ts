/**
 * POST /api/bayi-kampanya/save — insert bayi_campaigns and broadcast to
 * targeted dealers via WhatsApp. Magic-link invalidated on success.
 *
 * Body: {
 *   token,
 *   name, description?,
 *   start_date, end_date (ISO yyyy-mm-dd),
 *   discount_type: "percent" | "price",
 *   discount_value: number,
 *   product_ids: string[],
 *   target: "all" | "selected",
 *   dealer_ids?: string[] (when target === "selected")
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { BAYI_CAPABILITIES } from "@/tenants/bayi/capabilities";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    if (!token) return NextResponse.json({ error: "Token gerekli" }, { status: 400 });

    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim() || null;
    const startDate = String(body.start_date || "").trim();
    const endDate = String(body.end_date || "").trim();
    const discountType = body.discount_type === "price" ? "price" : "percent";
    const discountValue = Math.max(0, Number(body.discount_value) || 0);
    const productIds: string[] = Array.isArray(body.product_ids) ? body.product_ids.filter((x: unknown) => typeof x === "string") : [];
    const target: "all" | "selected" = body.target === "selected" ? "selected" : "all";
    const dealerIdsIn: string[] = target === "selected" && Array.isArray(body.dealer_ids)
      ? body.dealer_ids.filter((x: unknown) => typeof x === "string")
      : [];

    if (name.length < 2) return NextResponse.json({ error: "Kampanya adı en az 2 karakter." }, { status: 400 });
    if (!startDate || !endDate) return NextResponse.json({ error: "Tarih aralığı gerekli." }, { status: 400 });
    if (new Date(endDate) < new Date(startDate)) return NextResponse.json({ error: "Bitiş tarihi başlangıçtan önce olamaz." }, { status: 400 });
    if (discountValue <= 0) return NextResponse.json({ error: "Geçerli indirim değeri girin." }, { status: 400 });
    if (productIds.length === 0) return NextResponse.json({ error: "En az bir ürün seçin." }, { status: 400 });

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
      .select("id, tenant_id, capabilities, whatsapp_phone, display_name")
      .eq("id", magicToken.user_id)
      .single();
    if (!profile?.tenant_id) return NextResponse.json({ error: "Profil eksik." }, { status: 500 });

    const caps = (profile.capabilities as string[] | null) || [];
    if (!(caps.includes("*") || caps.includes(BAYI_CAPABILITIES.CAMPAIGNS_CREATE))) {
      return NextResponse.json({ error: "Kampanya oluşturma yetkiniz yok." }, { status: 403 });
    }

    // Insert campaign. Schema tolerant: save settings as JSON in "details"
    // metadata column if it exists, otherwise into "description".
    const metadata = {
      discount_type: discountType,
      discount_value: discountValue,
      product_ids: productIds,
      target,
      dealer_ids: dealerIdsIn,
    };
    const { data: camp, error: campErr } = await supabase
      .from("bayi_campaigns")
      .insert({
        tenant_id: profile.tenant_id,
        title: name,
        description,
        start_date: startDate,
        end_date: endDate,
        is_active: true,
        metadata,
      })
      .select("id")
      .single();

    if (campErr || !camp) {
      console.error("[bayi-kampanya:save] campaign insert err", campErr);
      return NextResponse.json({ error: campErr?.message || "Kampanya kaydedilemedi." }, { status: 500 });
    }

    await supabase.from("magic_link_tokens").update({ used_at: new Date().toISOString() }).eq("id", magicToken.id);

    // Broadcast to dealers
    let recipients: Array<{ user_id: string; phone: string; company: string }> = [];
    if (target === "all") {
      const { data } = await supabase
        .from("bayi_dealers")
        .select("id, company_name, user_id")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true);
      const userIds = (data || []).map((d) => d.user_id).filter(Boolean) as string[];
      if (userIds.length) {
        const { data: dealerProfiles } = await supabase
          .from("profiles")
          .select("id, whatsapp_phone")
          .in("id", userIds);
        const phoneMap = new Map<string, string>();
        for (const p of dealerProfiles || []) if (p.whatsapp_phone) phoneMap.set(p.id as string, p.whatsapp_phone as string);
        recipients = (data || [])
          .map((d) => ({ user_id: d.user_id as string, phone: phoneMap.get(d.user_id as string) || "", company: d.company_name as string }))
          .filter((r) => r.phone);
      }
    } else if (dealerIdsIn.length) {
      const { data } = await supabase
        .from("bayi_dealers")
        .select("id, company_name, user_id")
        .in("id", dealerIdsIn);
      const userIds = (data || []).map((d) => d.user_id).filter(Boolean) as string[];
      if (userIds.length) {
        const { data: dealerProfiles } = await supabase
          .from("profiles")
          .select("id, whatsapp_phone")
          .in("id", userIds);
        const phoneMap = new Map<string, string>();
        for (const p of dealerProfiles || []) if (p.whatsapp_phone) phoneMap.set(p.id as string, p.whatsapp_phone as string);
        recipients = (data || [])
          .map((d) => ({ user_id: d.user_id as string, phone: phoneMap.get(d.user_id as string) || "", company: d.company_name as string }))
          .filter((r) => r.phone);
      }
    }

    let sent = 0;
    const discountLabel = discountType === "percent" ? `%${discountValue} indirim` : `${new Intl.NumberFormat("tr-TR").format(discountValue)} ₺ indirim`;
    for (const r of recipients) {
      try {
        await sendButtons(r.phone,
          `🎉 *Yeni Kampanya: ${name}*\n\n${description ? `${description}\n\n` : ""}💸 ${discountLabel}\n📅 ${startDate} → ${endDate}\n\nHemen siparişinizi oluşturun!`,
          [
            { id: "cmd:siparisver", title: "📦 Sipariş Ver" },
            { id: "cmd:menu", title: "Menü" },
          ],
        );
        sent++;
      } catch (err) {
        console.error(`[bayi-kampanya:save] broadcast failed to ${r.phone}:`, err);
      }
    }

    if (profile.whatsapp_phone) {
      try {
        await sendButtons(profile.whatsapp_phone,
          `✅ Kampanya oluşturuldu!\n\n📢 ${name}\n💸 ${discountLabel}\n📅 ${startDate} → ${endDate}\n\n${sent > 0 ? `📤 ${sent} bayiye duyuru gönderildi.` : "Duyuru gönderilmedi."}`,
          [
            { id: "cmd:kampanyalar", title: "📢 Kampanyalar" },
            { id: "cmd:menu", title: "Ana Menü" },
          ],
        );
      } catch { /* ignore */ }
    }

    return NextResponse.json({ success: true, campaignId: camp.id, broadcast: sent });
  } catch (err) {
    console.error("[bayi-kampanya:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
