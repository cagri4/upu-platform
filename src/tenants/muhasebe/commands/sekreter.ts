/**
 * Sekreter commands:
 * /mukellefler — Mukellef listesi
 * /mukellef_ekle — Yeni mukellef kaydi (multi-step)
 * /takvim — Beyanname takvimi
 * /yaklasan — 7 gun icindeki deadline
 * /randevular — Randevu listesi
 * /brifing — Gunluk brifing
 */

import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { formatCurrency, formatDate, todayISO } from "./helpers";

// ── mukellefler ───────────────────────────────────────────────────────

export async function handleMukellefler(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: rows, error } = await supabase
      .from("muh_mukellefler")
      .select("id, name, vkn, phone, is_active")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(15);

    if (error) {
      console.error("[muhasebe:mukellefler] error:", error);
      await sendText(ctx.phone, "Mukellef listesi yuklenirken bir hata olustu.");
      return;
    }

    if (!rows?.length) {
      await sendButtons(ctx.phone, "Kayitli mukellef bulunmuyor.", [
        { id: "cmd:mukellef_ekle", title: "Mukellef Ekle" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = rows.map((m: any, i: number) => {
      const vkn = m.vkn ? ` (VKN: ${m.vkn})` : "";
      return `${i + 1}. ${m.name}${vkn}`;
    });

    await sendButtons(
      ctx.phone,
      `*Mukellef Listesi* (${rows.length})\n\n${lines.join("\n")}`,
      [
        { id: "cmd:mukellef_ekle", title: "Mukellef Ekle" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[muhasebe:mukellefler] error:", err);
    await sendText(ctx.phone, "Mukellef listesi yuklenirken bir hata olustu.");
  }
}

// ── mukellef_ekle (multi-step) ────────────────────────────────────────

export async function handleMukellefEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "mukellef_ekle", "waiting_name");
  await sendText(ctx.phone, "*Yeni Mukellef Kaydi*\n\nMukellefin adini/unvanini yazin:");
}

export async function stepMukellefEkle(ctx: WaContext, session: CommandSession): Promise<void> {
  const data = session.data as Record<string, unknown>;

  if (session.current_step === "waiting_name") {
    await updateSession(ctx.userId, "waiting_vkn", { name: ctx.text.trim() });
    await sendText(ctx.phone, "VKN (Vergi Kimlik Numarasi) yazin (bos birakmak icin '-' yazin):");
    return;
  }

  if (session.current_step === "waiting_vkn") {
    const vkn = ctx.text.trim() === "-" ? null : ctx.text.trim();
    await updateSession(ctx.userId, "waiting_phone", { vkn });
    await sendText(ctx.phone, "Telefon numarasi yazin (bos birakmak icin '-' yazin):");
    return;
  }

  if (session.current_step === "waiting_phone") {
    const phone = ctx.text.trim() === "-" ? null : ctx.text.trim();

    try {
      const supabase = getServiceClient();
      const { error } = await supabase.from("muh_mukellefler").insert({
        tenant_id: ctx.tenantId,
        name: data.name as string,
        vkn: data.vkn as string | null,
        phone,
      });

      if (error) {
        console.error("[muhasebe:mukellef_ekle] insert error:", error);
        await sendText(ctx.phone, "Mukellef kaydedilirken bir hata olustu.");
      } else {
        await sendButtons(
          ctx.phone,
          `Mukellef kaydedildi: *${data.name}*`,
          [
            { id: "cmd:mukellefler", title: "Mukellef Listesi" },
            { id: "cmd:menu", title: "Ana Menu" },
          ],
        );
      }
    } catch (err) {
      console.error("[muhasebe:mukellef_ekle] error:", err);
      await sendText(ctx.phone, "Mukellef kaydedilirken bir hata olustu.");
    }

    await endSession(ctx.userId);
    return;
  }

  // Unexpected step
  await endSession(ctx.userId);
}

// ── takvim ────────────────────────────────────────────────────────────

export async function handleTakvim(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: statuses, error } = await supabase
      .from("muh_beyanname_statuses")
      .select("id, beyanname_type, period, status, deadline_date")
      .eq("tenant_id", ctx.tenantId)
      .order("deadline_date", { ascending: true })
      .limit(15);

    if (error) {
      console.error("[muhasebe:takvim] error:", error);
      await sendText(ctx.phone, "Takvim yuklenirken bir hata olustu.");
      return;
    }

    if (!statuses?.length) {
      await sendButtons(ctx.phone, "Beyanname takviminde kayit bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = statuses.map((s: any, i: number) => {
      const type = s.beyanname_type || "Bilinmeyen";
      const period = s.period || "-";
      const status = s.status || "-";
      const deadline = s.deadline_date ? formatDate(s.deadline_date) : "-";
      return `${i + 1}. ${type} (${period}) — ${status}\n   Son: ${deadline}`;
    });

    await sendButtons(
      ctx.phone,
      `*Beyanname Takvimi*\n\n${lines.join("\n")}`,
      [
        { id: "cmd:yaklasan", title: "Yaklasan" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[muhasebe:takvim] error:", err);
    await sendText(ctx.phone, "Takvim yuklenirken bir hata olustu.");
  }
}

// ── yaklasan ──────────────────────────────────────────────────────────

export async function handleYaklasan(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = todayISO();
    const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data: upcoming, error } = await supabase
      .from("muh_beyanname_statuses")
      .select("beyanname_type, period, status, deadline_date")
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi")
      .gte("deadline_date", today)
      .lte("deadline_date", weekLater)
      .order("deadline_date", { ascending: true });

    if (error) {
      console.error("[muhasebe:yaklasan] error:", error);
      await sendText(ctx.phone, "Yaklasan deadlinelar yuklenirken bir hata olustu.");
      return;
    }

    if (!upcoming?.length) {
      await sendButtons(ctx.phone, "Onumuzdeki 7 gun icinde yaklasan deadline bulunmuyor.", [
        { id: "cmd:takvim", title: "Tam Takvim" },
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = upcoming.map((s: any, i: number) => {
      const deadline = s.deadline_date ? formatDate(s.deadline_date) : "-";
      return `${i + 1}. ${s.beyanname_type} (${s.period || "-"}) — ${deadline}`;
    });

    await sendButtons(
      ctx.phone,
      `*Yaklasan Deadlinelar (7 Gun)*\n\n${lines.join("\n")}`,
      [
        { id: "cmd:takvim", title: "Tam Takvim" },
        { id: "cmd:menu", title: "Ana Menu" },
      ],
    );
  } catch (err) {
    console.error("[muhasebe:yaklasan] error:", err);
    await sendText(ctx.phone, "Yaklasan deadlinelar yuklenirken bir hata olustu.");
  }
}

// ── randevular ────────────────────────────────────────────────────────

export async function handleRandevular(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();

    const { data: appointments, error } = await supabase
      .from("muh_appointments")
      .select("id, date, time, subject, notes")
      .eq("tenant_id", ctx.tenantId)
      .gte("date", todayISO())
      .order("date", { ascending: true })
      .limit(10);

    if (error) {
      console.error("[muhasebe:randevular] error:", error);
      await sendText(ctx.phone, "Randevular yuklenirken bir hata olustu.");
      return;
    }

    if (!appointments?.length) {
      await sendButtons(ctx.phone, "Yaklasan randevu bulunmuyor.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const lines = appointments.map((a: any, i: number) => {
      const date = a.date ? formatDate(a.date) : "-";
      const time = a.time || "";
      const subject = a.subject || "Konu belirtilmemis";
      return `${i + 1}. ${date} ${time} — ${subject}`;
    });

    await sendButtons(
      ctx.phone,
      `*Randevular*\n\n${lines.join("\n")}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[muhasebe:randevular] error:", err);
    await sendText(ctx.phone, "Randevular yuklenirken bir hata olustu.");
  }
}

// ── brifing ───────────────────────────────────────────────────────────

export async function handleBrifing(ctx: WaContext): Promise<void> {
  try {
    const supabase = getServiceClient();
    const today = todayISO();

    // Pending filings
    const { count: pendingCount } = await supabase
      .from("muh_beyanname_statuses")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .neq("status", "tamamlandi");

    // Today's reminders
    const { data: todayReminders } = await supabase
      .from("muh_reminders")
      .select("type, message")
      .eq("tenant_id", ctx.tenantId)
      .eq("deadline_date", today);

    // Today's appointments
    const { data: todayAppointments } = await supabase
      .from("muh_appointments")
      .select("time, subject")
      .eq("tenant_id", ctx.tenantId)
      .eq("date", today);

    // Recent invoices (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentInvoiceCount } = await supabase
      .from("muh_invoices")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .gte("created_at", weekAgo);

    // Overdue receivables
    const { count: overdueCount } = await supabase
      .from("muh_invoices")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .not("due_date", "is", null)
      .lt("due_date", today);

    const lines: string[] = [
      `*Gunluk Brifing*`,
      ``,
      `Bekleyen beyanname: ${pendingCount ?? 0}`,
      `Son 7 gun fatura: ${recentInvoiceCount ?? 0}`,
      `Geciken alacak: ${overdueCount ?? 0}`,
    ];

    if (todayReminders?.length) {
      lines.push(`\n*Bugunun hatirlatmalari:*`);
      todayReminders.forEach((r: any) => {
        lines.push(`  - [${r.type || "Genel"}] ${r.message || "-"}`);
      });
    } else {
      lines.push(`\nBugun hatirlatma yok.`);
    }

    if (todayAppointments?.length) {
      lines.push(`\n*Bugunun randevulari:*`);
      todayAppointments.forEach((a: any) => {
        lines.push(`  - ${a.time || "?"} ${a.subject || "-"}`);
      });
    } else {
      lines.push(`Bugun randevu yok.`);
    }

    await sendButtons(ctx.phone, lines.join("\n"), [
      { id: "cmd:takvim", title: "Takvim" },
      { id: "cmd:alacaklar", title: "Alacaklar" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[muhasebe:brifing] error:", err);
    await sendText(ctx.phone, "Brifing olusturulurken bir hata olustu.");
  }
}
