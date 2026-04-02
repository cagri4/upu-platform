/**
 * Market — SKT (Son Kullanma Tarihi) komutlari
 *
 * /sktkontrol  — Son kullanma tarihi yaklasan urunleri listele
 * /sktekle     — Urune son kullanma tarihi ekle/guncelle
 */

import type { WaContext, StepHandler } from "@/platform/whatsapp/types";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── /sktkontrol — list expiring products (no multi-step) ────────────────

export async function handleSktKontrol(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const now = new Date();

    // Products expiring within 14 days
    const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: products } = await supabase
      .from("mkt_products")
      .select("name, expiry_date, quantity, unit")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .not("expiry_date", "is", null)
      .lte("expiry_date", twoWeeks)
      .order("expiry_date")
      .limit(20);

    if (!products?.length) {
      await sendButtons(ctx.phone, "Son 14 gun icinde SKT'si dolacak urun bulunamadi.", [
        { id: "cmd:stoksorgula", title: "Stok Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Separate into expired and expiring
    const expired = products.filter((p) => p.expiry_date && new Date(p.expiry_date) <= now);
    const expiring = products.filter((p) => p.expiry_date && new Date(p.expiry_date) > now);

    let msg = "*SKT Kontrol*\n\n";

    if (expired.length) {
      msg += `*SURESI DOLMUS (${expired.length}):*\n`;
      for (const p of expired) {
        const date = new Date(p.expiry_date!).toLocaleDateString("tr-TR");
        msg += `- ${p.name}: ${date} | ${p.quantity} ${p.unit}\n`;
      }
      msg += "\n";
    }

    if (expiring.length) {
      msg += `*YAKLASIYOR (${expiring.length}):*\n`;
      for (const p of expiring) {
        const date = new Date(p.expiry_date!).toLocaleDateString("tr-TR");
        const daysLeft = Math.ceil((new Date(p.expiry_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        msg += `- ${p.name}: ${date} (${daysLeft} gun) | ${p.quantity} ${p.unit}\n`;
      }
    }

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:fiyatkampanya", title: "Kampanya Olustur" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:sktkontrol] error:", err);
    await sendText(ctx.phone, "SKT kontrolu sirasinda bir hata olustu.");
  }
}

// ── /sktekle — multi-step: product name → expiry date ──────────────────

export async function handleSktEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "sktekle", "name");
  await sendText(ctx.phone, "SKT eklenecek urun adini girin:");
}

export const stepSktEkle: StepHandler = async (ctx, session) => {
  const step = session.current_step;

  if (step === "name") {
    const name = ctx.text.trim();
    if (!name) {
      await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "date", { name });
    await sendText(ctx.phone, `Urun: *${name}*\nSon kullanma tarihini girin (GG.AA.YYYY):`);
    return;
  }

  if (step === "date") {
    const dateStr = ctx.text.trim();
    // Parse Turkish date format DD.MM.YYYY
    const parts = dateStr.split(/[./\-]/);
    if (parts.length !== 3) {
      await sendText(ctx.phone, "Gecerli bir tarih girin (GG.AA.YYYY):");
      return;
    }
    const [day, month, year] = parts.map(Number);
    const expiryDate = new Date(year, month - 1, day);
    if (isNaN(expiryDate.getTime())) {
      await sendText(ctx.phone, "Gecerli bir tarih girin (GG.AA.YYYY):");
      return;
    }

    const name = session.data.name as string;
    await endSession(ctx.userId);

    try {
      const supabase = getServiceClient();

      const { data: product } = await supabase
        .from("mkt_products")
        .select("id, name")
        .eq("tenant_id", ctx.tenantId)
        .ilike("name", name)
        .eq("is_active", true)
        .single();

      if (!product) {
        await sendButtons(ctx.phone, `Urun bulunamadi: ${name}`, [
          { id: "cmd:stoksorgula", title: "Stok Listesi" },
          { id: "cmd:menu", title: "Ana Menu" },
        ]);
        return;
      }

      await supabase
        .from("mkt_products")
        .update({ expiry_date: expiryDate.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", product.id);

      const formattedDate = expiryDate.toLocaleDateString("tr-TR");
      await sendButtons(ctx.phone,
        `*${product.name}* SKT guncellendi: ${formattedDate}`,
        [{ id: "cmd:sktkontrol", title: "SKT Kontrol" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
    } catch (err) {
      console.error("[market:sktekle] error:", err);
      await sendText(ctx.phone, "SKT eklerken bir hata olustu.");
    }
  }
};
