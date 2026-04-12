/**
 * /hatirlatma — Step-by-step reminder creation
 *
 * Simplified for WhatsApp: topic (buttons) -> note (text) -> date (buttons) -> confirm
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";

const TOPICS = [
  { label: "Ev Gezdirme", value: "ev_gezdirme" },
  { label: "Telefon Görüşme", value: "telefon" },
  { label: "Teklif Sunma", value: "teklif" },
  { label: "Randevu", value: "randevu" },
  { label: "Kendi Yazın", value: "custom" },
];

export async function handleHatirlatma(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "hatirlatma", "topic");

  await sendButtons(ctx.phone, "📋 Hatırlatma konusu nedir?", [
    { id: "htrt:topic:ev_gezdirme", title: "Ev Gezdirme" },
    { id: "htrt:topic:telefon", title: "Telefon" },
    { id: "htrt:topic:custom", title: "Kendi Yazın" },
  ]);
}

export async function handleHatirlatmaStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  const step = session.current_step;

  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın.");
    return;
  }

  if (step === "custom_topic") {
    await updateSession(ctx.userId, "note", { topic: "custom", topic_label: text });
    await sendText(ctx.phone, "📝 Not eklemek ister misiniz? (yazin veya \"gec\")");
    return;
  }

  if (step === "note") {
    const noteText = (text.toLowerCase() === "gec" || text.toLowerCase() === "geç") ? "" : text;
    await updateSession(ctx.userId, "date", { note: noteText });
    await sendButtons(ctx.phone, "📅 Hangi tarih?", [
      { id: "htrt:date:today", title: "Bugün" },
      { id: "htrt:date:tomorrow", title: "Yarın" },
      { id: "htrt:date:next_monday", title: "Haftaya Pzt" },
    ]);
    return;
  }

  if (step === "time_custom") {
    const timeMatch = text.match(/^(\d{1,2})[:\.]?(\d{2})?$/);
    if (!timeMatch) {
      await sendText(ctx.phone, "Geçerli saat yazın. Örnek: 14:30 veya 10");
      return;
    }
    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2] || "0", 10);
    if (hour < 0 || hour > 23) {
      await sendText(ctx.phone, "Geçerli saat yazın (0-23).");
      return;
    }
    const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    await updateSession(ctx.userId, "confirm", { time: timeStr });
    await createReminder(ctx);
    return;
  }

  await sendText(ctx.phone, "Lütfen yukarıdaki butonlardan birini seçin.");
}

export async function handleHatirlatmaCallback(ctx: WaContext, data: string): Promise<void> {
  if (data === "htrt:cancel") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Hatırlatma iptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const parts = data.split(":");

  // Topic selected
  if (parts[1] === "topic") {
    const topicValue = parts[2];

    if (topicValue === "custom") {
      await updateSession(ctx.userId, "custom_topic", { topic: "custom" });
      await sendText(ctx.phone, "✏️ Hatırlatma konusunu yazın:");
      return;
    }

    const topic = TOPICS.find(t => t.value === topicValue);
    const topicLabel = topic?.label || topicValue;

    await updateSession(ctx.userId, "note", { topic: topicValue, topic_label: topicLabel });
    await sendText(ctx.phone, `${topicLabel} seçildi.\n\n📝 Not eklemek ister misiniz? (yazin veya \"gec\")`);
    return;
  }

  // Date selected
  if (parts[1] === "date") {
    const now = new Date();
    let targetDate: Date;

    switch (parts[2]) {
      case "today": targetDate = now; break;
      case "tomorrow": targetDate = new Date(now); targetDate.setDate(targetDate.getDate() + 1); break;
      case "next_monday": {
        targetDate = new Date(now);
        const dow = targetDate.getDay();
        targetDate.setDate(targetDate.getDate() + (dow === 0 ? 1 : 8 - dow));
        break;
      }
      default: targetDate = now;
    }

    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
    await updateSession(ctx.userId, "time", { date: dateStr });

    await sendButtons(ctx.phone, "🕐 Saat kaçta?", [
      { id: "htrt:time:09:00", title: "09:00" },
      { id: "htrt:time:14:00", title: "14:00" },
      { id: "htrt:time:custom", title: "Saat Yazın" },
    ]);
    return;
  }

  // Time selected
  if (parts[1] === "time") {
    const value = parts.slice(2).join(":");

    if (value === "custom") {
      await updateSession(ctx.userId, "time_custom", {});
      await sendText(ctx.phone, "🕐 Saati yazın. Örnek: 14:30 veya 10");
      return;
    }

    await updateSession(ctx.userId, "confirm", { time: value });
    await createReminder(ctx);
    return;
  }
}

async function createReminder(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase
    .from("command_sessions")
    .select("data")
    .eq("user_id", ctx.userId)
    .single();

  if (!sess) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Oturum süresi doldu. Tekrar /hatirlatma yazın.");
    return;
  }

  const d = sess.data as Record<string, unknown>;
  const topicLabel = (d.topic_label as string) || (d.topic as string) || "Hatirlatma";
  const note = (d.note as string) || "";
  const dueAt = new Date(`${d.date}T${d.time}:00`);

  if (isNaN(dueAt.getTime())) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Tarih/saat hatası. Tekrar /hatirlatma yazın.");
    return;
  }

  const message = note ? `${topicLabel} — ${note}` : topicLabel;

  const { error } = await supabase.from("reminders").insert({
    tenant_id: ctx.tenantId,
    user_id: ctx.userId,
    topic: d.topic || "custom",
    message,
    due_at: dueAt.toISOString(),
    sent: false,
  });

  await endSession(ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "❌ Hatırlatma oluşturulurken hata oluştu.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const dateDisplay = dueAt.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
  await sendText(ctx.phone,
    `✅ Hatırlatma oluşturuldu!\n\n📋 ${topicLabel}\n📅 ${dateDisplay} — 🕐 ${d.time}\n\nSekreteriniz size zamanında hatırlatma yapacak.`,
  );
  await logEvent(ctx.tenantId, ctx.userId, "hatirlatma", `${topicLabel} — ${dateDisplay}`);

  const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
  await triggerMissionCheck(ctx.userId, ctx.tenantKey, "hatirlatma", ctx.phone);
}
