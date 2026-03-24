/**
 * /temizlik — Today's housekeeping tasks
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, todayISO, today, NO_HOTEL_MSG } from "./helpers";

const STATUS_ICON: Record<string, string> = {
  pending: "...",
  in_progress: ">>",
  completed: "OK",
};

export async function handleTemizlik(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: tasks } = await supabase
      .from("otel_housekeeping_tasks")
      .select("id, task_type, priority, assigned_to, status, notes, otel_rooms(name)")
      .eq("hotel_id", hotelId)
      .eq("queue_date", todayISO())
      .order("priority", { ascending: true })
      .limit(20);

    if (!tasks?.length) {
      await sendButtons(ctx.phone,
        prefix("oda", `*Temizlik Gorevleri* — ${today()}\n\nBugun icin gorev bulunmuyor.`),
        [{ id: "cmd:odalar", title: "Odalar" }, { id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    const pending = tasks.filter((t: any) => t.status === "pending").length;
    const inProgress = tasks.filter((t: any) => t.status === "in_progress").length;
    const completed = tasks.filter((t: any) => t.status === "completed").length;

    const lines = tasks.map((t: any, i: number) => {
      const room = t.otel_rooms?.name ?? "-";
      const icon = STATUS_ICON[t.status] || "?";
      const assignee = t.assigned_to ? ` (${t.assigned_to})` : "";
      return `${i + 1}. ${room} — ${t.task_type} [${icon}]${assignee}`;
    });

    await sendButtons(ctx.phone,
      prefix("oda", `*Temizlik Gorevleri* — ${today()}\nBekleyen: ${pending} | Devam: ${inProgress} | Tamamlanan: ${completed}\n\n${lines.join("\n")}`),
      [{ id: "cmd:odalar", title: "Odalar" }, { id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[otel:temizlik] error:", err);
    await sendButtons(ctx.phone, "Temizlik gorevleri yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
