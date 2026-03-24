import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── Command: start mulkekle flow ────────────────────────────────────────

export async function handleMulkEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "mulkekle", "title");
  await sendText(ctx.phone, "🏠 İlan başlığını yazın:\n\nÖrnek: \"Yalıkavak Kiralık 2+1 Daire\" veya \"Bodrum Satılık Villa\"");
}

// ── Step handler ────────────────────────────────────────────────────────

export async function handleMulkEkleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const step = session.current_step;
  const text = ctx.text;

  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın.");
    return;
  }

  switch (step) {
    case "title": {
      if (text.length < 3) {
        await sendText(ctx.phone, "Başlık en az 3 karakter olmalı. Tekrar yazın:");
        return;
      }
      await updateSession(ctx.userId, "price", { title: text });
      await sendText(ctx.phone, "💰 Fiyatı yazın:\n\nÖrnek: 4500000, 4.5M, 25 bin, 750.000");
      return;
    }

    case "price": {
      const price = parsePrice(text);
      if (!price) {
        await sendText(ctx.phone, "Geçerli bir fiyat yazın. Örnek: 4500000, 4.5M, 25 bin");
        return;
      }
      await updateSession(ctx.userId, "m2", { price });
      await sendText(ctx.phone, "📐 Metrekareyi yazın:\n\nÖrnek: 120");
      return;
    }

    case "m2": {
      const m2 = parseInt(text.replace(/[^\d]/g, ""), 10);
      if (!m2 || m2 < 5) {
        await sendText(ctx.phone, "Geçerli bir metrekare yazın. Örnek: 120");
        return;
      }
      await updateSession(ctx.userId, "rooms", { m2 });
      await sendButtons(ctx.phone, "🛏 Oda sayısını seçin:", [
        { id: "mulkekle:rooms:2+1", title: "2+1" },
        { id: "mulkekle:rooms:3+1", title: "3+1" },
        { id: "mulkekle:rooms:4+1", title: "4+1" },
      ]);
      return;
    }

    default:
      await sendText(ctx.phone, "Lütfen yukarıdaki butonlardan birini seçin.");
      return;
  }
}

// ── Callback handler ────────────────────────────────────────────────────

export async function handleMulkEkleCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.split(":");
  if (parts.length < 3) return;

  const [, field, value] = parts;

  if (field === "rooms") {
    await updateSession(ctx.userId, "listing_type", { rooms: value });
    await sendButtons(ctx.phone, "📋 İlan türünü seçin:", [
      { id: "mulkekle:lt:satilik", title: "🏷 Satılık" },
      { id: "mulkekle:lt:kiralik", title: "🔑 Kiralık" },
    ]);
    return;
  }

  if (field === "lt") {
    await updateSession(ctx.userId, "done", { listing_type: value });

    // Get session data and create property
    const supabase = getServiceClient();
    const { data: session } = await supabase
      .from("command_sessions")
      .select("data")
      .eq("user_id", ctx.userId)
      .single();

    if (!session) {
      await endSession(ctx.userId);
      await sendText(ctx.phone, "Bir hata oluştu. Tekrar deneyin.");
      return;
    }

    const d = session.data as Record<string, unknown>;

    const { error } = await supabase.from("emlak_properties").insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      title: d.title,
      price: d.price,
      area: d.m2,
      rooms: d.rooms,
      listing_type: d.listing_type,
      status: "aktif",
    });

    await endSession(ctx.userId);

    if (error) {
      await sendButtons(ctx.phone, "❌ Mülk eklenirken hata oluştu.", [
        { id: "cmd:mulkekle", title: "Tekrar Dene" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const priceStr = new Intl.NumberFormat("tr-TR").format(d.price as number);
    const ltLabel = value === "satilik" ? "Satılık" : "Kiralık";

    await sendButtons(ctx.phone,
      `✅ Mülk başarıyla eklendi!\n\n` +
      `📋 ${d.title}\n💰 ${priceStr} TL\n📐 ${d.m2} m²\n🛏 ${d.rooms}\n🏷 ${ltLabel}`,
      [
        { id: "cmd:portfoyum", title: "Portföyüm" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  }
}

// ── Price parser ────────────────────────────────────────────────────────

function parsePrice(text: string): number | null {
  let cleaned = text.replace(/TL/gi, "").replace(/-/g, "").trim();
  const mMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(?:M|milyon)$/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1].replace(",", ".")) * 1_000_000);
  const binMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*bin$/i);
  if (binMatch) return Math.round(parseFloat(binMatch[1].replace(",", ".")) * 1_000);
  const num = parseInt(cleaned.replace(/[.\s]/g, "").replace(",", ""), 10);
  return isNaN(num) ? null : num;
}
