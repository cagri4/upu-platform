import { assertTenant, type ToolDef } from "@/platform/agent/types";

/**
 * Önümüzdeki N gün (default 7) hatırlatma + randevu listesi.
 * emlak_calendar_events tablosu: scheduled_at, status (pending|sent|done),
 * related_customer_id, related_property_id. Sent_at NULL ise henüz mesaj
 * gönderilmemiş.
 */
export const readCalendarUpcomingTool: ToolDef = {
  name: "read_calendar_upcoming",
  description:
    "Önümüzdeki N gün içindeki hatırlatma ve randevuları döner. Status pending olanlar 'henüz tetiklenmemiş' demek. 'Bugünkü hatırlatmalar', 'yarın ne var', 'haftalık ajanda' soruları için.",
  expectedTenantKey: "emlak",
  input_schema: {
    type: "object",
    properties: {
      days: {
        type: "number",
        description: "İleri kaç gün (default 7, max 30).",
      },
    },
  },
  async handler(input, ctx) {
    assertTenant(ctx, "emlak", "read_calendar_upcoming");
    const days = typeof input.days === "number" ? Math.max(1, Math.min(30, Math.floor(input.days))) : 7;
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const { data } = await ctx.sb
      .from("emlak_calendar_events")
      .select("id, title, description, scheduled_at, status, sent_at, related_customer_id, related_property_id, created_at")
      .eq("user_id", ctx.userId)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", until.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    const rows = (data || []) as Array<{
      id: string;
      title: string | null;
      description: string | null;
      scheduled_at: string;
      status: string | null;
      sent_at: string | null;
      related_customer_id: string | null;
      related_property_id: string | null;
    }>;

    const byStatus: Record<string, number> = {};
    for (const r of rows) {
      if (r.status) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    }

    return {
      window_days: days,
      from: now.toISOString(),
      to: until.toISOString(),
      total: rows.length,
      by_status: byStatus,
      events: rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        scheduled_at: r.scheduled_at,
        status: r.status,
        triggered: !!r.sent_at,
        related_customer_id: r.related_customer_id,
        related_property_id: r.related_property_id,
      })),
    };
  },
};
