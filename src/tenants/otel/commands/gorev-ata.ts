/**
 * /gorevata — Assign housekeeping task (multi-step: room → task type → priority → assignee)
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, todayISO, NO_HOTEL_MSG } from "./helpers";

// ── Command entry ───────────────────────────────────────────────────────

export async function handleGorevAta(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  const supabase = getServiceClient();
  const { data: rooms } = await supabase
    .from("otel_rooms")
    .select("id, name, room_type, status")
    .eq("hotel_id", hotelId)
    .order("sort_order", { ascending: true })
    .limit(10);

  if (!rooms?.length) {
    await sendButtons(ctx.phone, prefix("oda", "Henuz oda tanimlanmamis."), [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
    return;
  }

  await startSession(ctx.userId, ctx.tenantId, "gorevata", "room");
  await sendList(ctx.phone,
    prefix("oda", "*Gorev Atama*\n\nGorev atamak istediginiz odayi secin:"),
    "Odalar",
    [{
      title: "Oda Listesi",
      rows: rooms.map((r: any) => ({
        id: `gorev_room:${r.id}`,
        title: r.name,
        description: r.room_type,
      })),
    }],
  );
}

// ── Step handler ────────────────────────────────────────────────────────

export async function handleGorevAtaStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const step = session.current_step;
  const text = ctx.text;

  if (step === "assignee") {
    const assignee = text?.trim();
    if (!assignee || assignee.length < 2) {
      await sendText(ctx.phone, "Gorevli adini yazin veya 'atla' yazarak bos birakin:");
      return;
    }

    const name = assignee.toLowerCase() === "atla" ? null : assignee;
    await updateSession(ctx.userId, "notes", { assigned_to: name });
    await sendText(ctx.phone, prefix("oda", `Ek not eklemek ister misiniz?\n\nNot yazin veya 'atla' yazin:`));
    return;
  }

  if (step === "notes") {
    const notes = text?.toLowerCase() === "atla" ? null : text?.trim() || null;

    // Create the task
    const supabase = getServiceClient();
    const { data: sessionData } = await supabase
      .from("command_sessions")
      .select("data")
      .eq("user_id", ctx.userId)
      .single();

    if (!sessionData) {
      await endSession(ctx.userId);
      await sendText(ctx.phone, "Bir hata olustu.");
      return;
    }

    const d = { ...(sessionData.data as Record<string, unknown>), notes } as Record<string, unknown>;
    const hotelId = await getHotelId(ctx.userId, ctx.tenantId);

    const { error } = await supabase.from("otel_housekeeping_tasks").insert({
      hotel_id: hotelId,
      room_id: d.room_id,
      task_type: d.task_type,
      priority: d.priority === "high" ? 1 : 2,
      assigned_to: d.assigned_to || null,
      notes: d.notes || null,
      status: "pending",
      queue_date: todayISO(),
    });

    await endSession(ctx.userId);

    if (error) {
      console.error("[otel:gorevata] insert error:", error);
      await sendButtons(ctx.phone, "Gorev eklenirken hata olustu.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const taskLabels: Record<string, string> = {
      standard: "Standart Temizlik",
      deep: "Derin Temizlik",
      checkout: "Check-out Temizlik",
      maintenance: "Bakim",
    };

    await sendButtons(ctx.phone,
      prefix("oda", `✅ Gorev atandi!\n\n🚪 Oda: ${d.room_name}\n📋 Tur: ${taskLabels[d.task_type as string] || d.task_type}\n⚡ Oncelik: ${d.priority === "high" ? "Yuksek" : "Normal"}${d.assigned_to ? `\n👤 Gorevli: ${d.assigned_to}` : ""}${d.notes ? `\n📝 Not: ${d.notes}` : ""}`),
      [
        { id: "cmd:temizlik", title: "Temizlik Listesi" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
    return;
  }

  await sendText(ctx.phone, "Lutfen butonlardan secim yapin.");
}

// ── Callback handler ────────────────────────────────────────────────────

export async function handleGorevAtaCallback(ctx: WaContext, data: string): Promise<void> {
  // gorev_room:<room_id> — Room selected
  if (data.startsWith("gorev_room:")) {
    const roomId = data.replace("gorev_room:", "");
    const supabase = getServiceClient();
    const { data: room } = await supabase
      .from("otel_rooms")
      .select("id, name")
      .eq("id", roomId)
      .maybeSingle();

    if (!room) {
      await sendText(ctx.phone, "Oda bulunamadi.");
      return;
    }

    await updateSession(ctx.userId, "task_type", { room_id: roomId, room_name: room.name });
    await sendButtons(ctx.phone,
      prefix("oda", `Oda: *${room.name}*\n\nGorev turunu secin:`),
      [
        { id: "gorev_type:standard", title: "Standart Temizlik" },
        { id: "gorev_type:deep", title: "Derin Temizlik" },
        { id: "gorev_type:checkout", title: "Check-out Temizlik" },
      ],
    );
    return;
  }

  // gorev_type:<type> — Task type selected
  if (data.startsWith("gorev_type:")) {
    const taskType = data.replace("gorev_type:", "");
    await updateSession(ctx.userId, "priority", { task_type: taskType });
    await sendButtons(ctx.phone,
      prefix("oda", "Oncelik secin:"),
      [
        { id: "gorev_pri:high", title: "Yuksek" },
        { id: "gorev_pri:normal", title: "Normal" },
      ],
    );
    return;
  }

  // gorev_pri:<priority> — Priority selected
  if (data.startsWith("gorev_pri:")) {
    const priority = data.replace("gorev_pri:", "");
    await updateSession(ctx.userId, "assignee", { priority });
    await sendText(ctx.phone, prefix("oda", "Gorevli adini yazin:\n\nOrnek: Mehmet\n\nAtlamak icin 'atla' yazin."));
    return;
  }
}
