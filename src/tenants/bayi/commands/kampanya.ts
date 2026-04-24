/**
 * /kampanyalar — Aktif kampanyaları listele
 * /kampanyaolustur — Web panel yönlendirme
 * /teklifver — Web panel yönlendirme
 * /performans — Bayi performans karşılaştırması
 * /segment — Bayi segmentasyonu analizi
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, formatDate, webPanelRedirect } from "./helpers";

export async function handleKampanyalar(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: campaigns } = await supabase
      .from("bayi_campaigns")
      .select("id, title, description, start_date, end_date, is_active")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(10);

    if (!campaigns?.length) {
      await sendButtons(ctx.phone, "💰 *Aktif Kampanyalar*\n\nSu anda aktif kampanya bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = campaigns.map((c: any, i: number) => {
      const end = c.end_date ? `Bitis: ${formatDate(c.end_date)}` : "Surekli";
      return `${i + 1}. 🟢 *${c.title}*\n   ${c.description || ""}\n   ${end}`;
    });

    await sendButtons(ctx.phone, `💰 *Aktif Kampanyalar*\n\n${lines.join("\n\n")}`, [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[bayi:kampanyalar] error:", err);
    await sendText(ctx.phone, "Kampanyalar yuklenirken bir hata olustu.");
  }
}

export async function handleKampanyaOlustur(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expiresAt,
  });

  const formUrl = `https://retailai.upudev.nl/tr/bayi-kampanya?t=${token}`;
  const { sendUrlButton } = await import("@/platform/whatsapp/send");
  await sendUrlButton(ctx.phone,
    `📢 *Kampanya Oluştur*\n\nÜrünleri seç, indirim belirle, bayilere duyur. Form kaydedildikten sonra WhatsApp'tan teyit düşecek.\n\n_Link 2 saat geçerli._`,
    "📝 Formu Aç",
    formUrl,
    { skipNav: true },
  );
}

export async function handleTeklifVer(ctx: WaContext): Promise<void> {
  await webPanelRedirect(ctx.phone, "💰 *Teklif Hazirlama*\nTeklif olusturmak icin web panelini kullanin.");
}

export async function handlePerformans(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const [targetsRes, ordersRes] = await Promise.all([
      supabase
        .from("bayi_sales_targets")
        .select("dealer_id, target_amount, achieved_amount, period_start, period_end, bayi_dealers!inner(company_name)")
        .eq("tenant_id", ctx.tenantId)
        .order("period_end", { ascending: false })
        .limit(20),
      supabase
        .from("bayi_orders")
        .select("dealer_id, total_amount, bayi_dealers!inner(company_name)")
        .eq("tenant_id", ctx.tenantId)
        .limit(200),
    ]);

    const targets = targetsRes.data || [];
    const orders = ordersRes.data || [];

    const dealerRevenue: Record<string, { name: string; revenue: number; orderCount: number }> = {};
    orders.forEach((o: any) => {
      const id = o.dealer_id;
      const name = o.bayi_dealers?.company_name || "Bilinmeyen";
      if (!dealerRevenue[id]) dealerRevenue[id] = { name, revenue: 0, orderCount: 0 };
      dealerRevenue[id].revenue += o.total_amount || 0;
      dealerRevenue[id].orderCount += 1;
    });

    const sorted = Object.values(dealerRevenue).sort((a, b) => b.revenue - a.revenue);

    if (!sorted.length) {
      await sendButtons(ctx.phone, "📊 *Performans*\n\nHenuz siparis verisi bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = sorted.slice(0, 10).map((d, i) => {
      const target = targets.find((t: any) => t.bayi_dealers?.company_name === d.name);
      const perc = target && target.target_amount > 0
        ? ` | Hedef: %${Math.round((d.revenue / target.target_amount) * 100)}`
        : "";
      return `${i + 1}. *${d.name}* — ${formatCurrency(d.revenue)} (${d.orderCount} siparis)${perc}`;
    });

    const totalRevenue = sorted.reduce((s, d) => s + d.revenue, 0);
    const totalOrders = sorted.reduce((s, d) => s + d.orderCount, 0);

    await sendButtons(
      ctx.phone,
      `📊 *Bayi Performans*\n\n${lines.join("\n")}\n\n*Toplam:* ${formatCurrency(totalRevenue)} | ${totalOrders} siparis\n\n_Detay icin /bayidurum [isim] yazin._`,
      [{ id: "cmd:segment", title: "Segmentasyon" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:performans] error:", err);
    await sendText(ctx.phone, "Performans verisi yuklenirken bir hata olustu.");
  }
}

export async function handleSegment(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: dealers } = await supabase
      .from("bayi_dealers")
      .select("id, company_name")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);

    if (!dealers?.length) {
      await sendButtons(ctx.phone, "📊 *Bayi Segmentasyonu*\n\nAktif bayi bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const { data: orders } = await supabase
      .from("bayi_orders")
      .select("dealer_id, total_amount")
      .eq("tenant_id", ctx.tenantId)
      .limit(500);

    const dealerStats: Record<string, { name: string; revenue: number; orderCount: number }> = {};
    dealers.forEach((d: any) => { dealerStats[d.id] = { name: d.company_name, revenue: 0, orderCount: 0 }; });
    (orders || []).forEach((o: any) => {
      if (dealerStats[o.dealer_id]) {
        dealerStats[o.dealer_id].revenue += o.total_amount || 0;
        dealerStats[o.dealer_id].orderCount += 1;
      }
    });

    const all = Object.values(dealerStats);
    const segA = all.filter(d => d.revenue >= 30000);
    const segB = all.filter(d => d.revenue >= 15000 && d.revenue < 30000);
    const segC = all.filter(d => d.revenue < 15000);

    const fmt = (seg: typeof all) => seg.length
      ? seg.map(d => `${d.name} (${formatCurrency(d.revenue)})`).join(", ")
      : "Yok";
    const sumRev = (seg: typeof all) => seg.reduce((s, d) => s + d.revenue, 0);

    await sendButtons(
      ctx.phone,
      `📊 *Bayi Segmentasyonu*\n\n🥇 *A Segment* (>₺30.000)\n${fmt(segA)}\n→ ${segA.length} bayi | ${formatCurrency(sumRev(segA))}\n\n🥈 *B Segment* (₺15.000-₺30.000)\n${fmt(segB)}\n→ ${segB.length} bayi | ${formatCurrency(sumRev(segB))}\n\n🥉 *C Segment* (<₺15.000)\n${fmt(segC)}\n→ ${segC.length} bayi | ${formatCurrency(sumRev(segC))}`,
      [{ id: "cmd:performans", title: "Performans" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[bayi:segment] error:", err);
    await sendText(ctx.phone, "Segment verisi yuklenirken bir hata olustu.");
  }
}
