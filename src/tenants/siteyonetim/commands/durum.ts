/**
 * /durum — Ariza takip durumu sorgulama (sakin)
 * /bakim — Yonetici: tum acik ariza listesi
 * /toplanti — Placeholder for toplanti cagrisi
 * /mesaj — Placeholder for tekil sakin mesaji
 * /hukuk — Placeholder for hukuki danisma
 * /mevzuat — Placeholder for KMK mevzuat bilgisi
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getStaffContext } from "./helpers";

/**
 * /durum — Sakin: kendi acik ariza biletlerini listeler
 */
export async function handleDurum(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: tickets } = await supabase
      .from("sy_maintenance_tickets")
      .select("id, category, priority, status, description, created_at")
      .eq("reported_by_user_id", ctx.userId)
      .neq("status", "tamamlandi")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!tickets || tickets.length === 0) {
      await sendButtons(ctx.phone, "Acik ariza bildiniz bulunmuyor.", [
        { id: "cmd:ariza", title: "Ariza Bildir" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = tickets.map((t: any) => {
      const shortId = t.id.slice(0, 8);
      const statusIcon = t.status === "acik" ? "Acik" : "Atandi";
      return `#${shortId} [${statusIcon}] ${t.category} (${t.priority})\n  ${t.description.substring(0, 60)}`;
    });

    await sendButtons(ctx.phone, `Ariza Taleplerim\n\n${lines.join("\n\n")}`, [
      { id: "cmd:ariza", title: "Yeni Ariza" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[sy:durum] error:", err);
    await sendText(ctx.phone, "Ariza durumu sorgulanirken hata olustu.");
  }
}

/**
 * /bakim — Yonetici: tum binaya ait acik ariza listesi
 */
export async function handleBakim(ctx: WaContext): Promise<void> {
  try {
    const mc = await getStaffContext(ctx.userId);
    if (!mc) {
      await sendButtons(ctx.phone, "Bir binaya baglanmaniz gerekiyor. Yoneticinize basvurun.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const supabase = getServiceClient();

    const { data: tickets } = await supabase
      .from("sy_maintenance_tickets")
      .select("id, category, priority, status, description, created_at")
      .eq("building_id", mc.building.id)
      .neq("status", "tamamlandi")
      .order("created_at", { ascending: false })
      .limit(15);

    if (!tickets || tickets.length === 0) {
      await sendButtons(ctx.phone, `${mc.building.name} -- Bakim\n\nAcik ariza bileti bulunmuyor.`, [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = tickets.map((t: any) => {
      const shortId = t.id.slice(0, 8);
      const statusLabel = t.status === "acik" ? "Acik" : "Atandi";
      return `#${shortId} [${statusLabel}] ${t.category} (${t.priority})\n  ${t.description.substring(0, 60)}`;
    });

    await sendButtons(
      ctx.phone,
      `${mc.building.name} -- Acik Arizalar (${tickets.length})\n\n${lines.join("\n\n")}`,
      [{ id: "cmd:rapor", title: "Rapor" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[sy:bakim] error:", err);
    await sendText(ctx.phone, "Bakim listesi yuklenirken hata olustu.");
  }
}

/**
 * /toplanti — Placeholder
 */
export async function handleToplanti(ctx: WaContext): Promise<void> {
  await sendButtons(ctx.phone, "Toplanti cagrisi ozelligi yakin zamanda aktif olacak.", [
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
}

/**
 * /mesaj — Placeholder
 */
export async function handleMesaj(ctx: WaContext): Promise<void> {
  await sendButtons(ctx.phone, "Tekil sakin mesaji ozelligi yakin zamanda aktif olacak.", [
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
}

/**
 * /hukuk — Placeholder
 */
export async function handleHukuk(ctx: WaContext): Promise<void> {
  await sendButtons(ctx.phone, "Hukuki danisma ozelligi yakin zamanda aktif olacak.", [
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
}

/**
 * /mevzuat — Placeholder
 */
export async function handleMevzuat(ctx: WaContext): Promise<void> {
  await sendButtons(ctx.phone, "KMK mevzuat sorgulama ozelligi yakin zamanda aktif olacak.", [
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
}
