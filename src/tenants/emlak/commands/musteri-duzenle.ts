/**
 * /musteriDuzenle — Edit customer details
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

const EDITABLE_FIELDS = [
  { key: "phone", label: "Telefon", dbColumn: "phone", hint: "Telefon numarasi" },
  { key: "email", label: "Email", dbColumn: "email", hint: "Email adresi" },
  { key: "budget_min", label: "Butce Min", dbColumn: "budget_min", hint: "Minimum butce (TL veya 2.5M)" },
  { key: "budget_max", label: "Butce Max", dbColumn: "budget_max", hint: "Maximum butce (TL veya 5M)" },
  { key: "location", label: "Lokasyon", dbColumn: "location", hint: "Bolge (virgul ile)" },
  { key: "notes", label: "Not", dbColumn: "notes", hint: "Musteri notu" },
];

export async function handleMusteriDuzenle(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: customers } = await supabase
    .from("emlak_customers")
    .select("id, name, phone")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!customers || customers.length === 0) {
    await sendButtons(ctx.phone, "Henuz musteriniz yok.", [
      { id: "cmd:musteriEkle", title: "Musteri Ekle" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  const rows = customers.map(c => ({
    id: `md_select:${c.id}`,
    title: ((c.name || "Isimsiz") as string).substring(0, 24),
    description: (c.phone as string) || "",
  }));

  await sendList(ctx.phone, "Duzenlemek istediginiz musteriyi secin:", "Musteri Sec", [
    { title: "Musteriler", rows },
  ]);
}

export async function handleMusteriDuzenleCallback(ctx: WaContext, data: string): Promise<void> {
  // md_select:customerId
  if (data.startsWith("md_select:")) {
    const customerId = data.replace("md_select:", "");
    const supabase = getServiceClient();

    const { data: customer } = await supabase
      .from("emlak_customers")
      .select("id, name")
      .eq("id", customerId)
      .eq("user_id", ctx.userId)
      .single();

    if (!customer) {
      await sendButtons(ctx.phone, "Musteri bulunamadi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
      return;
    }

    await startSession(ctx.userId, ctx.tenantId, "musteriDuzenle", "select_field");
    await updateSession(ctx.userId, "select_field", { customerId, customerName: customer.name });

    const rows = EDITABLE_FIELDS.map(f => ({
      id: `md_edit:${f.key}:${customerId}`,
      title: f.label,
      description: f.hint,
    }));

    await sendList(ctx.phone, `"${customer.name}" — Hangi alani duzenlemek istiyorsunuz?`, "Alan Sec", [
      { title: "Alanlar", rows },
    ]);
    return;
  }

  // md_edit:field:customerId
  if (data.startsWith("md_edit:")) {
    const parts = data.split(":");
    if (parts.length < 3) return;
    const field = parts[1];
    const customerId = parts.slice(2).join(":");

    const fieldDef = EDITABLE_FIELDS.find(f => f.key === field);
    if (!fieldDef) return;

    await startSession(ctx.userId, ctx.tenantId, "musteriDuzenle", "waiting_value");
    await updateSession(ctx.userId, "waiting_value", { customerId, field, dbColumn: fieldDef.dbColumn });

    await sendText(ctx.phone, `${fieldDef.label} icin yeni degeri yazin:\n\n${fieldDef.hint}`);
    return;
  }
}

export async function handleMusteriDuzenleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  if (!text) {
    await sendText(ctx.phone, "Lutfen bir deger yazin.");
    return;
  }

  if (session.current_step !== "waiting_value") {
    await sendText(ctx.phone, "Lutfen yukaridaki butonlardan birini secin.");
    return;
  }

  const { customerId, field, dbColumn } = session.data as { customerId: string; field: string; dbColumn: string };
  let parsedValue: unknown = text;

  if (field === "budget_min" || field === "budget_max") {
    const mMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*[Mm]$/);
    parsedValue = mMatch
      ? parseFloat(mMatch[1].replace(",", ".")) * 1_000_000
      : parseFloat(text.replace(/[.,]/g, ""));
    if (isNaN(parsedValue as number)) {
      await sendText(ctx.phone, "Gecerli bir butce yazin. Ornek: 5M, 3000000");
      return;
    }
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("emlak_customers")
    .update({ [dbColumn]: parsedValue })
    .eq("id", customerId)
    .eq("user_id", ctx.userId);

  await endSession(ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "Guncelleme hatasi.", [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  const fieldLabel = EDITABLE_FIELDS.find(f => f.key === field)?.label || field;
  await sendButtons(ctx.phone, `✅ ${fieldLabel} guncellendi.`, [
    { id: "cmd:musterilerim", title: "Musterilerim" },
    { id: "cmd:menu", title: "Ana Menu" },
  ]);
}
