/**
 * Market — Fiyat komutlari
 *
 * /fiyatguncelle  — Urun fiyatini guncelle
 * /fiyatkampanya  — Indirim kampanyasi tanimla
 * /fiyatsorgula   — Urun fiyat ve kampanya bilgisi
 */

import type { WaContext, StepHandler } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency, formatDate } from "./helpers";

// ── /fiyatguncelle — multi-step: name → price ──────────────────────────

export async function handleFiyatGuncelle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "fiyatguncelle", "name");
  await sendText(ctx.phone, "Fiyati guncellenecek urun adini girin:");
}

export const stepFiyatGuncelle: StepHandler = async (ctx, session) => {
  const step = session.current_step;
  const data = session.data as Record<string, unknown>;

  if (step === "name") {
    const name = ctx.text.trim();
    if (!name) {
      await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "price", { name });
    await sendText(ctx.phone, `Urun: *${name}*\nYeni fiyati girin (TL):`);
    return;
  }

  if (step === "price") {
    const price = Number(ctx.text.trim());
    if (isNaN(price) || price <= 0) {
      await sendText(ctx.phone, "Gecerli bir fiyat girin:");
      return;
    }
    const name = data.name as string;

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
        .update({ price, updated_at: new Date().toISOString() })
        .eq("id", product.id);

      await sendButtons(ctx.phone,
        `✅ *${product.name}* fiyati ${formatCurrency(price)} olarak guncellendi.`,
        [{ id: "cmd:fiyatsorgula", title: "Fiyat Sorgula" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
    } catch (err) {
      console.error("[market:fiyatguncelle] error:", err);
      await sendText(ctx.phone, "Fiyat guncellerken bir hata olustu.");
    }
  }
};

// ── /fiyatkampanya — multi-step: name → discount → days ─────────────────

export async function handleFiyatKampanya(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "fiyatkampanya", "name");
  await sendText(ctx.phone, "Kampanya urun adini girin:");
}

export const stepFiyatKampanya: StepHandler = async (ctx, session) => {
  const step = session.current_step;
  const data = session.data as Record<string, unknown>;

  if (step === "name") {
    const name = ctx.text.trim();
    if (!name) {
      await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "discount", { name });
    await sendText(ctx.phone, `Urun: *${name}*\nIndirim yuzdesi girin (ornek: 20):`);
    return;
  }

  if (step === "discount") {
    const discountPercent = Number(ctx.text.trim());
    if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      await sendText(ctx.phone, "1-100 arasi bir yuzde girin:");
      return;
    }
    await updateSession(ctx.userId, "days", { discountPercent });
    await sendText(ctx.phone, "Kampanya kac gun sureli? (ornek: 7):");
    return;
  }

  if (step === "days") {
    const days = Number(ctx.text.trim());
    if (isNaN(days) || days <= 0) {
      await sendText(ctx.phone, "Gecerli bir gun sayisi girin:");
      return;
    }

    const name = data.name as string;
    const discountPercent = data.discountPercent as number;

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

      const now = new Date();
      const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

      await supabase
        .from("mkt_campaigns")
        .insert({
          tenant_id: ctx.tenantId,
          product_id: product.id,
          discount_percent: discountPercent,
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          is_active: true,
        });

      await sendButtons(ctx.phone,
        `🎉 *${product.name}* icin %${discountPercent} indirim, ${days} gun sureli kampanya tanimlandi.\n\nBitis: ${formatDate(endsAt.toISOString())}`,
        [{ id: "cmd:fiyatsorgula", title: "Fiyat Sorgula" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
    } catch (err) {
      console.error("[market:fiyatkampanya] error:", err);
      await sendText(ctx.phone, "Kampanya olusturulurken bir hata olustu.");
    }
  }
};

// ── /fiyatsorgula — multi-step: ask product name ────────────────────────

export async function handleFiyatSorgula(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "fiyatsorgula", "name");
  await sendText(ctx.phone, "Fiyat sorgulanacak urun adini girin:");
}

export const stepFiyatSorgula: StepHandler = async (ctx, session) => {
  const name = ctx.text.trim();
  if (!name) {
    await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
    return;
  }

  await endSession(ctx.userId);

  try {
    const supabase = getServiceClient();

    const { data: product } = await supabase
      .from("mkt_products")
      .select("id, name, price")
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

    let msg = `💰 *${product.name}*\nFiyat: ${formatCurrency(product.price)}`;

    // Check for active campaign
    const { data: campaigns } = await supabase
      .from("mkt_campaigns")
      .select("discount_percent, ends_at")
      .eq("product_id", product.id)
      .eq("is_active", true)
      .gt("ends_at", new Date().toISOString())
      .limit(1);

    if (campaigns && campaigns.length > 0) {
      const campaign = campaigns[0];
      const endDate = formatDate(campaign.ends_at);
      msg += `\n🎉 Kampanya: %${campaign.discount_percent} indirim, ${endDate}'e kadar`;
    }

    await sendButtons(ctx.phone, msg, [
      { id: "cmd:fiyatguncelle", title: "Fiyat Guncelle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:fiyatsorgula] error:", err);
    await sendText(ctx.phone, "Fiyat sorgulanirken bir hata olustu.");
  }
};
