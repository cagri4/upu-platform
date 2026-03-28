/**
 * /ariza — Multi-step ariza bildirimi (category → priority → description)
 *
 * Uses command sessions for multi-step flow.
 * Callbacks: ariza_cat:<val>, ariza_pri:<val>
 * Steps: category → priority → description
 */

import type { WaContext, StepHandler, CallbackHandler } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getStaffContext } from "./helpers";

/**
 * /ariza — entry point: show category selection
 */
export async function handleAriza(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "ariza", "category");

  await sendButtons(ctx.phone, "Ariza kategorisini secin:", [
    { id: "ariza_cat:elektrik", title: "Elektrik" },
    { id: "ariza_cat:su", title: "Su/Tesisat" },
    { id: "ariza_cat:asansor", title: "Asansor" },
  ]);
  // WhatsApp max 3 buttons per message, send rest in second message
  await sendButtons(ctx.phone, "Diger kategoriler:", [
    { id: "ariza_cat:mekanik", title: "Mekanik" },
    { id: "ariza_cat:diger", title: "Diger" },
  ]);
}

/**
 * Callback: ariza_cat:<category> — user selected a category
 */
export async function handleArizaCategoryCallback(ctx: WaContext, callbackData: string): Promise<void> {
  const category = callbackData.replace("ariza_cat:", "");
  await updateSession(ctx.userId, "priority", { category });

  await sendButtons(ctx.phone, "Oncelik secin:", [
    { id: "ariza_pri:acil", title: "Acil" },
    { id: "ariza_pri:normal", title: "Normal" },
    { id: "ariza_pri:dusuk", title: "Dusuk" },
  ]);
}

/**
 * Callback: ariza_pri:<priority> — user selected a priority
 */
export async function handleArizaPriorityCallback(ctx: WaContext, callbackData: string): Promise<void> {
  const priority = callbackData.replace("ariza_pri:", "");
  await updateSession(ctx.userId, "description", { priority });

  await sendText(ctx.phone, "Arizayi kisaca aciklayin:");
}

/**
 * Step handler: handles free text during active ariza session
 */
export const handleArizaStep: StepHandler = async (ctx: WaContext, session: CommandSession): Promise<void> => {
  if (session.current_step !== "description") return;

  const { category, priority } = session.data as { category: string; priority: string };

  const sc = await getStaffContext(ctx.userId);
  if (!sc) {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "Bir binaya baglanmaniz gerekiyor. Yoneticinize basvurun.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const supabase = getServiceClient();

  const insertData: Record<string, unknown> = {
    building_id: sc.building.id,
    reported_by_user_id: ctx.userId,
    category,
    priority: priority || "normal",
    description: ctx.text,
    status: "acik",
  };
  // unit_id is optional — managers may not have a unit
  if (sc.unit) insertData.unit_id = sc.unit.id;

  const { data: ticket, error } = await supabase
    .from("sy_maintenance_tickets")
    .insert(insertData)
    .select("id")
    .single();

  await endSession(ctx.userId);

  if (error || !ticket) {
    console.error("[sy:ariza] insert error:", error);
    await sendText(ctx.phone, "Ariza bileti olusturulurken hata olustu. Tekrar deneyin.");
    return;
  }

  const shortId = ticket.id.slice(0, 8);
  await sendButtons(
    ctx.phone,
    `Ariza bileti olusturuldu.\n\nTakip no: ${shortId}\nKategori: ${category}\nOncelik: ${priority}\nAciklama: ${ctx.text}\n\nYoneticiniz en kisa surede ilgilenecektir.`,
    [{ id: "cmd:menu", title: "Ana Menu" }],
  );
};
