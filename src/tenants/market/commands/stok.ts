/**
 * Market — Stok komutlari
 *
 * /stokekle      — Urun ekle veya mevcut urune stok ekle
 * /stokguncelle  — Urun stok miktarini guncelle
 * /stoksil       — Urunu pasife al
 * /stoksorgula   — Stok listesi veya tek urun detayi
 */

import type { WaContext, StepHandler } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { formatCurrency } from "./helpers";

// ── /stokekle — entry point ──────────────────────────────────────────────

export async function handleStokEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "stokekle", "name");
  await sendText(ctx.phone, "Urun adi girin:");
}

export const stepStokEkle: StepHandler = async (ctx, session) => {
  const step = session.current_step;
  const data = session.data as Record<string, unknown>;

  if (step === "name") {
    const name = ctx.text.trim();
    if (!name) {
      await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "quantity", { name });
    await sendText(ctx.phone, `Urun: *${name}*\nMiktar girin (sayi):`);
    return;
  }

  if (step === "quantity") {
    const qty = Number(ctx.text.trim());
    if (isNaN(qty) || qty <= 0) {
      await sendText(ctx.phone, "Gecerli bir sayi girin:");
      return;
    }
    await updateSession(ctx.userId, "unit", { quantity: qty });
    await sendButtons(ctx.phone, "Birim secin veya yazin:", [
      { id: "mkt_unit:adet", title: "Adet" },
      { id: "mkt_unit:kg", title: "Kg" },
      { id: "mkt_unit:litre", title: "Litre" },
    ]);
    return;
  }

  if (step === "unit") {
    const unit = ctx.text.trim().toLowerCase() || "adet";
    const name = data.name as string;
    const quantity = data.quantity as number;

    await endSession(ctx.userId);

    try {
      const supabase = getServiceClient();

      const { data: existing } = await supabase
        .from("mkt_products")
        .select("id, name, quantity, unit")
        .eq("tenant_id", ctx.tenantId)
        .ilike("name", name)
        .eq("is_active", true)
        .single();

      if (existing) {
        const newQty = Number(existing.quantity) + quantity;
        await supabase
          .from("mkt_products")
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq("id", existing.id);

        await sendButtons(ctx.phone,
          `✅ *${existing.name}*: ${newQty} ${existing.unit}\n(onceki: ${existing.quantity}, eklenen: ${quantity})`,
          [{ id: "cmd:stoksorgula", title: "Stok Listesi" }, { id: "cmd:menu", title: "Ana Menu" }],
        );
      } else {
        await supabase
          .from("mkt_products")
          .insert({ tenant_id: ctx.tenantId, name, quantity, unit: unit || "adet" });

        await sendButtons(ctx.phone,
          `✅ *${name}*: ${quantity} ${unit || "adet"} eklendi.`,
          [{ id: "cmd:stoksorgula", title: "Stok Listesi" }, { id: "cmd:menu", title: "Ana Menu" }],
        );
      }
    } catch (err) {
      console.error("[market:stokekle] error:", err);
      await sendText(ctx.phone, "Stok eklerken bir hata olustu.");
    }
  }
};

// ── unit callback (interactive button) ───────────────────────────────────

export async function handleUnitCallback(ctx: WaContext, callbackData: string): Promise<void> {
  const unit = callbackData.replace("mkt_unit:", "");
  // Treat the callback as if user typed the unit
  const session = await (await import("@/platform/whatsapp/session")).getSession(ctx.userId);
  if (!session || session.command !== "stokekle" || session.current_step !== "unit") return;
  // Manually set ctx.text and call step handler
  await stepStokEkle({ ...ctx, text: unit } as WaContext, session);
}

// ── /stokguncelle — entry point ──────────────────────────────────────────

export async function handleStokGuncelle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "stokguncelle", "name");
  await sendText(ctx.phone, "Guncellenecek urun adini girin:");
}

export const stepStokGuncelle: StepHandler = async (ctx, session) => {
  const step = session.current_step;

  if (step === "name") {
    const name = ctx.text.trim();
    if (!name) {
      await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "quantity", { name });
    await sendText(ctx.phone, `Urun: *${name}*\nYeni stok miktarini girin:`);
    return;
  }

  if (step === "quantity") {
    const quantity = Number(ctx.text.trim());
    if (isNaN(quantity) || quantity < 0) {
      await sendText(ctx.phone, "Gecerli bir sayi girin:");
      return;
    }
    const name = session.data.name as string;

    await endSession(ctx.userId);

    try {
      const supabase = getServiceClient();

      const { data: existing } = await supabase
        .from("mkt_products")
        .select("id, name")
        .eq("tenant_id", ctx.tenantId)
        .ilike("name", name)
        .eq("is_active", true)
        .single();

      if (!existing) {
        await sendButtons(ctx.phone, `Urun bulunamadi: ${name}`, [
          { id: "cmd:stoksorgula", title: "Stok Listesi" },
          { id: "cmd:menu", title: "Ana Menu" },
        ]);
        return;
      }

      await supabase
        .from("mkt_products")
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      await sendButtons(ctx.phone,
        `✅ *${existing.name}*: stok ${quantity} olarak guncellendi.`,
        [{ id: "cmd:stoksorgula", title: "Stok Listesi" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
    } catch (err) {
      console.error("[market:stokguncelle] error:", err);
      await sendText(ctx.phone, "Stok guncellerken bir hata olustu.");
    }
  }
};

// ── /stoksil — entry point ───────────────────────────────────────────────

export async function handleStokSil(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "stoksil", "name");
  await sendText(ctx.phone, "Silinecek urun adini girin:");
}

export const stepStokSil: StepHandler = async (ctx, session) => {
  const name = ctx.text.trim();
  if (!name) {
    await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
    return;
  }

  await endSession(ctx.userId);

  try {
    const supabase = getServiceClient();

    const { data } = await supabase
      .from("mkt_products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", ctx.tenantId)
      .ilike("name", name)
      .eq("is_active", true)
      .select("id");

    if (!data || data.length === 0) {
      await sendButtons(ctx.phone, `Urun bulunamadi: ${name}`, [
        { id: "cmd:stoksorgula", title: "Stok Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    await sendButtons(ctx.phone, `🗑 *${name}* silindi.`, [
      { id: "cmd:stoksorgula", title: "Stok Listesi" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:stoksil] error:", err);
    await sendText(ctx.phone, "Urun silinirken bir hata olustu.");
  }
};

// ── /stoksorgula — list all products (no multi-step) ─────────────────────

export async function handleStokSorgula(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: products } = await supabase
      .from("mkt_products")
      .select("name, quantity, unit, price")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name")
      .limit(20);

    if (!products?.length) {
      await sendButtons(ctx.phone, "📦 Kayitli urun bulunamadi.\n\nstokekle ile urun ekleyin.", [
        { id: "cmd:stokekle", title: "Stok Ekle" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = products.map((p: any) =>
      `*${p.name}*: ${p.quantity} ${p.unit} — ${formatCurrency(p.price)}`,
    );

    await sendButtons(ctx.phone,
      `📦 *Stok Listesi*\n\n${lines.join("\n")}\n\nToplam: ${products.length} urun`,
      [{ id: "cmd:stokekle", title: "Stok Ekle" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[market:stoksorgula] error:", err);
    await sendText(ctx.phone, "Stok verisi yuklenirken bir hata olustu.");
  }
}
