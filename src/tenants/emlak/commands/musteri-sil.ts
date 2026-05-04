/**
 * /musterisil — Müşteri silme: liste seç → onay → soft delete (deleted_at).
 */
import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { logEvent } from "@/platform/whatsapp/error-handler";

export async function handleMusteriSil(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: customers } = await supabase
    .from("emlak_customers")
    .select("id, name, phone")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!customers || customers.length === 0) {
    await sendButtons(ctx.phone, "Silinecek müşteri yok.", [
      { id: "cmd:musteriEkle", title: "Müşteri Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const rows = customers.map(c => ({
    id: `mustsil:${c.id}`,
    title: ((c.name || "İsimsiz") as string).substring(0, 24),
    description: (c.phone as string) || "",
  }));

  await sendList(ctx.phone, "🗑 Hangi müşteriyi silmek istiyorsunuz?", "Müşteri Seç", [
    { title: "Müşteriler", rows },
  ]);
}

export async function handleMusteriSilCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.split(":");

  // mustsil:{customerId} — onay sor
  if (parts.length === 2) {
    const customerId = parts[1];
    const supabase = getServiceClient();
    const { data: customer } = await supabase
      .from("emlak_customers")
      .select("id, name")
      .eq("id", customerId)
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .single();

    if (!customer) {
      await sendButtons(ctx.phone, "Müşteri bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    await sendButtons(ctx.phone,
      `🗑 *${customer.name}* adlı müşteriyi silmek istediğinize emin misiniz?\n\n_Soft delete — geri almak için destek ile iletişime geçmeniz gerekir._`,
      [
        { id: `mustsil:confirm:${customerId}`, title: "✅ Eminim, sil" },
        { id: "cmd:musterilerim", title: "❌ İptal" },
      ],
      { skipNav: true },
    );
    return;
  }

  // mustsil:confirm:{customerId} — gerçekten sil
  if (parts[1] === "confirm") {
    const customerId = parts.slice(2).join(":");
    const supabase = getServiceClient();

    const { data: customer } = await supabase
      .from("emlak_customers")
      .select("id, name")
      .eq("id", customerId)
      .eq("user_id", ctx.userId)
      .is("deleted_at", null)
      .single();

    if (!customer) {
      await sendButtons(ctx.phone, "Müşteri bulunamadı veya zaten silinmiş.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const { error } = await supabase
      .from("emlak_customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", customerId)
      .eq("user_id", ctx.userId);

    if (error) {
      await sendButtons(ctx.phone, "Silme hatası.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    await logEvent(ctx.tenantId, ctx.userId, "musteri_sil", `${customer.name}`);
    await sendButtons(ctx.phone, `✅ *${customer.name}* silindi.`, [
      { id: "cmd:musterilerim", title: "👥 Müşterilerim" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
  }
}
