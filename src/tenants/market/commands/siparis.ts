/**
 * Market — Siparis komutlari
 *
 * /tedarikciekle    — Yeni tedarikci ekle
 * /tedarikciler     — Tedarikci listesi
 * /siparisolustur   — Yeni siparis olustur
 * /siparisekle      — Siparise urun ekle
 * /siparisler       — Aktif siparis listesi
 * /siparisdetay     — Siparis detayi
 * /siparisonayla    — Siparisi onayla
 * /siparisiptal     — Siparisi iptal et
 */

import type { WaContext, StepHandler } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { shortDate } from "./helpers";

// ── /tedarikciekle — multi-step: name → phone ───────────────────────────

export async function handleTedarikciEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "tedarikciekle", "name");
  await sendText(ctx.phone, "Tedarikci adini girin:");
}

export const stepTedarikciEkle: StepHandler = async (ctx, session) => {
  const step = session.current_step;
  const data = session.data as Record<string, unknown>;

  if (step === "name") {
    const name = ctx.text.trim();
    if (!name) {
      await sendText(ctx.phone, "Tedarikci adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "phone", { name });
    await sendText(ctx.phone, `Tedarikci: *${name}*\nTelefon numarasi girin (veya "atla" yazin):`);
    return;
  }

  if (step === "phone") {
    const input = ctx.text.trim();
    const phone = input.toLowerCase() === "atla" ? null : input;
    const name = data.name as string;

    await endSession(ctx.userId);

    try {
      const supabase = getServiceClient();

      const { error } = await supabase
        .from("mkt_suppliers")
        .insert({ tenant_id: ctx.tenantId, name, phone });

      if (error) {
        if (error.code === "23505") {
          await sendButtons(ctx.phone, `Tedarikci zaten kayitli: ${name}`, [
            { id: "cmd:tedarikciler", title: "Tedarikci Listesi" },
            { id: "cmd:menu", title: "Ana Menu" },
          ]);
          return;
        }
        await sendText(ctx.phone, `Hata: ${error.message}`);
        return;
      }

      await sendButtons(ctx.phone,
        `✅ Tedarikci eklendi: *${name}*${phone ? " (" + phone + ")" : ""}`,
        [{ id: "cmd:tedarikciler", title: "Tedarikci Listesi" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
    } catch (err) {
      console.error("[market:tedarikciekle] error:", err);
      await sendText(ctx.phone, "Tedarikci eklerken bir hata olustu.");
    }
  }
};

// ── /tedarikciler — list suppliers (no multi-step) ──────────────────────

export async function handleTedarikciler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: suppliers } = await supabase
      .from("mkt_suppliers")
      .select("name, phone")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name")
      .limit(20);

    if (!suppliers?.length) {
      await sendButtons(ctx.phone, "🏭 Kayitli tedarikci bulunamadi.", [
        { id: "cmd:tedarikciekle", title: "Tedarikci Ekle" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = suppliers.map((s: any, i: number) =>
      `${i + 1}. *${s.name}*${s.phone ? " — " + s.phone : ""}`,
    );

    await sendButtons(ctx.phone, `🏭 *Tedarikci Listesi*\n\n${lines.join("\n")}`, [
      { id: "cmd:tedarikciekle", title: "Tedarikci Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:tedarikciler] error:", err);
    await sendText(ctx.phone, "Tedarikci verisi yuklenirken bir hata olustu.");
  }
}

// ── /siparisolustur — multi-step: supplier name ─────────────────────────

export async function handleSiparisOlustur(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "siparisolustur", "supplier");
  await sendText(ctx.phone, "Tedarikci adini girin:");
}

export const stepSiparisOlustur: StepHandler = async (ctx, session) => {
  const supplierName = ctx.text.trim();
  if (!supplierName) {
    await sendText(ctx.phone, "Tedarikci adi bos olamaz. Tekrar girin:");
    return;
  }

  await endSession(ctx.userId);

  try {
    const supabase = getServiceClient();

    const { data: supplier } = await supabase
      .from("mkt_suppliers")
      .select("id, name")
      .eq("tenant_id", ctx.tenantId)
      .ilike("name", supplierName)
      .eq("is_active", true)
      .single();

    if (!supplier) {
      await sendButtons(ctx.phone, `Tedarikci bulunamadi: ${supplierName}`, [
        { id: "cmd:tedarikciler", title: "Tedarikci Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const { data: order, error } = await supabase
      .from("mkt_orders")
      .insert({ tenant_id: ctx.tenantId, supplier_id: supplier.id, status: "pending" })
      .select("id")
      .single();

    if (error || !order) {
      await sendText(ctx.phone, "Siparis olusturulamadi. Tekrar deneyin.");
      return;
    }

    const id8 = order.id.substring(0, 8);
    await sendButtons(ctx.phone,
      `✅ Siparis olusturuldu.\nID: *${id8}*\nTedarikci: ${supplier.name}\n\nSimdi siparise urun ekleyin.`,
      [{ id: "cmd:siparisekle", title: "Urun Ekle" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[market:siparisolustur] error:", err);
    await sendText(ctx.phone, "Siparis olustururken bir hata olustu.");
  }
};

// ── /siparisekle — multi-step: orderId → product → quantity ─────────────

export async function handleSiparisEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "siparisekle", "orderId");
  await sendText(ctx.phone, "Siparis ID girin (ilk 8 karakter):");
}

export const stepSiparisEkle: StepHandler = async (ctx, session) => {
  const step = session.current_step;
  const data = session.data as Record<string, unknown>;

  if (step === "orderId") {
    const orderId = ctx.text.trim();
    if (!orderId) {
      await sendText(ctx.phone, "Siparis ID bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "product", { orderId });
    await sendText(ctx.phone, "Urun adini girin:");
    return;
  }

  if (step === "product") {
    const productName = ctx.text.trim();
    if (!productName) {
      await sendText(ctx.phone, "Urun adi bos olamaz. Tekrar girin:");
      return;
    }
    await updateSession(ctx.userId, "quantity", { productName });
    await sendText(ctx.phone, `Urun: *${productName}*\nMiktar girin:`);
    return;
  }

  if (step === "quantity") {
    const quantity = Number(ctx.text.trim());
    if (isNaN(quantity) || quantity <= 0) {
      await sendText(ctx.phone, "Gecerli bir sayi girin:");
      return;
    }

    const orderId = data.orderId as string;
    const productName = data.productName as string;

    await endSession(ctx.userId);

    try {
      const supabase = getServiceClient();

      const { data: order } = await supabase
        .from("mkt_orders")
        .select("id, status")
        .eq("tenant_id", ctx.tenantId)
        .like("id", `${orderId}%`)
        .single();

      if (!order) {
        await sendButtons(ctx.phone, `Siparis bulunamadi: ${orderId}`, [
          { id: "cmd:siparisler", title: "Siparis Listesi" },
          { id: "cmd:menu", title: "Ana Menu" },
        ]);
        return;
      }

      if (order.status !== "pending") {
        await sendButtons(ctx.phone, `Siparis ${order.status} durumunda, urun eklenemez.`, [
          { id: "cmd:siparisler", title: "Siparis Listesi" },
          { id: "cmd:menu", title: "Ana Menu" },
        ]);
        return;
      }

      await supabase
        .from("mkt_order_items")
        .insert({ order_id: order.id, tenant_id: ctx.tenantId, product_name: productName, quantity });

      await sendButtons(ctx.phone,
        `✅ Eklendi: *${productName}* x${quantity}`,
        [{ id: "cmd:siparisekle", title: "Baska Urun Ekle" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
    } catch (err) {
      console.error("[market:siparisekle] error:", err);
      await sendText(ctx.phone, "Siparis urunu eklerken bir hata olustu.");
    }
  }
};

// ── /siparisler — list active orders (no multi-step) ────────────────────

export async function handleSiparisler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: orders } = await supabase
      .from("mkt_orders")
      .select("id, status, created_at, mkt_suppliers(name)")
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["pending", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (!orders?.length) {
      await sendButtons(ctx.phone, "📋 Aktif siparis bulunamadi.", [
        { id: "cmd:siparisolustur", title: "Siparis Olustur" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = orders.map((o: any) => {
      const id8 = o.id.substring(0, 8);
      const date = shortDate(o.created_at);
      const supplier = Array.isArray(o.mkt_suppliers) ? o.mkt_suppliers[0] : o.mkt_suppliers;
      const supplierName = supplier?.name || "-";
      const statusIcon = o.status === "pending" ? "⏳" : "✅";
      return `${statusIcon} *${id8}* | ${supplierName} | ${o.status} | ${date}`;
    });

    await sendButtons(ctx.phone,
      `📋 *Siparis Listesi*\n\n${lines.join("\n")}`,
      [{ id: "cmd:siparisolustur", title: "Yeni Siparis" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[market:siparisler] error:", err);
    await sendText(ctx.phone, "Siparis verisi yuklenirken bir hata olustu.");
  }
}

// ── /siparisdetay — multi-step: ask order ID ────────────────────────────

export async function handleSiparisDetay(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "siparisdetay", "orderId");
  await sendText(ctx.phone, "Siparis ID girin (ilk 8 karakter):");
}

export const stepSiparisDetay: StepHandler = async (ctx, session) => {
  const orderId = ctx.text.trim();
  if (!orderId) {
    await sendText(ctx.phone, "Siparis ID bos olamaz. Tekrar girin:");
    return;
  }

  await endSession(ctx.userId);

  try {
    const supabase = getServiceClient();

    const { data: order } = await supabase
      .from("mkt_orders")
      .select("id, status, created_at, mkt_suppliers(name)")
      .eq("tenant_id", ctx.tenantId)
      .like("id", `${orderId}%`)
      .single();

    if (!order) {
      await sendButtons(ctx.phone, `Siparis bulunamadi: ${orderId}`, [
        { id: "cmd:siparisler", title: "Siparis Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const { data: items } = await supabase
      .from("mkt_order_items")
      .select("product_name, quantity")
      .eq("order_id", order.id);

    const id8 = order.id.substring(0, 8);
    const date = shortDate(order.created_at);
    const orderSupplier = Array.isArray(order.mkt_suppliers) ? order.mkt_suppliers[0] : order.mkt_suppliers;
    const supplierName = (orderSupplier as any)?.name || "-";

    let msg = `📋 *Siparis: ${id8}*\nTedarikci: ${supplierName}\nDurum: ${order.status}\nTarih: ${date}\n`;

    if (items && items.length > 0) {
      msg += "\n*Urunler:*\n";
      msg += items.map((item: any) => `- ${item.product_name} x${item.quantity}`).join("\n");
    } else {
      msg += "\nHenuz urun eklenmemis.";
    }

    const buttons: Array<{ id: string; title: string }> = [];
    if (order.status === "pending") {
      buttons.push({ id: "cmd:siparisonayla", title: "Onayla" });
    }
    buttons.push({ id: "cmd:menu", title: "Ana Menu" });

    await sendButtons(ctx.phone, msg, buttons);
  } catch (err) {
    console.error("[market:siparisdetay] error:", err);
    await sendText(ctx.phone, "Siparis detayi yuklenirken bir hata olustu.");
  }
};

// ── /siparisonayla — multi-step: ask order ID ───────────────────────────

export async function handleSiparisOnayla(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "siparisonayla", "orderId");
  await sendText(ctx.phone, "Onaylanacak siparis ID girin:");
}

export const stepSiparisOnayla: StepHandler = async (ctx, session) => {
  const orderId = ctx.text.trim();
  await endSession(ctx.userId);
  await changeOrderStatus(orderId, "confirmed", ctx);
};

// ── /siparisiptal — multi-step: ask order ID ────────────────────────────

export async function handleSiparisIptal(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "siparisiptal", "orderId");
  await sendText(ctx.phone, "Iptal edilecek siparis ID girin:");
}

export const stepSiparisIptal: StepHandler = async (ctx, session) => {
  const orderId = ctx.text.trim();
  await endSession(ctx.userId);
  await changeOrderStatus(orderId, "cancelled", ctx);
};

// ── Shared: change order status ─────────────────────────────────────────

async function changeOrderStatus(
  orderId: string,
  targetStatus: "confirmed" | "cancelled",
  ctx: WaContext,
): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: order } = await supabase
      .from("mkt_orders")
      .select("id, status")
      .eq("tenant_id", ctx.tenantId)
      .like("id", `${orderId}%`)
      .single();

    if (!order) {
      await sendButtons(ctx.phone, `Siparis bulunamadi: ${orderId}`, [
        { id: "cmd:siparisler", title: "Siparis Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    if (order.status !== "pending") {
      await sendButtons(ctx.phone,
        `Siparis zaten ${order.status} durumunda, degistirilemez.`,
        [{ id: "cmd:siparisler", title: "Siparis Listesi" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    await supabase
      .from("mkt_orders")
      .update({ status: targetStatus, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    const actionWord = targetStatus === "confirmed" ? "onaylandi" : "iptal edildi";
    const icon = targetStatus === "confirmed" ? "✅" : "❌";
    await sendButtons(ctx.phone, `${icon} Siparis ${orderId} ${actionWord}.`, [
      { id: "cmd:siparisler", title: "Siparis Listesi" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[market:changeOrderStatus] error:", err);
    await sendText(ctx.phone, "Siparis durumu degistirilirken bir hata olustu.");
  }
}
