import type { ToolDef } from "@/platform/agent/types";

export const listOverdueInvoicesTool: ToolDef = {
  name: "list_overdue_invoices",
  description: "Vadesi geçmiş AKTİF faturaları listeler (status=open AND due_date < today). Hatırlatma yapma, tahsilat planı, kritik müşteri tespiti için kullan.",
  input_schema: {
    type: "object",
    properties: {
      limit: { type: "number", description: "Maks fatura (default 20)." },
    },
  },
  async handler(input, ctx) {
    const limit = Math.min(100, Number(input.limit) || 20);
    const isAdmin = ["admin", "muhasebe"].includes(ctx.role || "");
    const today = new Date().toISOString().slice(0, 10);

    let query = ctx.sb
      .from("bayi_invoices")
      .select("id, dealer_user_id, invoice_no, issue_date, due_date, amount, notes")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "open")
      .lt("due_date", today)
      .order("due_date", { ascending: true })
      .limit(limit);

    if (!isAdmin) query = query.eq("dealer_user_id", ctx.userId);

    const { data, error } = await query;
    if (error) return { error: "Fatura listesi alınamadı: " + error.message };

    // Dealer adları
    const ids = Array.from(new Set((data || []).map((r) => r.dealer_user_id)));
    const { data: dealers } = ids.length
      ? await ctx.sb.from("profiles").select("id, display_name, metadata").in("id", ids)
      : { data: [] };
    const dealerMap = Object.fromEntries(
      (dealers || []).map((d) => {
        const meta = (d.metadata as Record<string, unknown>) || {};
        const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
        return [d.id, firma?.ticari_unvan || d.display_name || "Bayi"];
      }),
    );

    return {
      total: data?.length || 0,
      invoices: (data || []).map((r) => {
        const daysOverdue = Math.floor((Date.now() - new Date(r.due_date as string).getTime()) / 86400000);
        return {
          invoice_no: r.invoice_no,
          dealer: dealerMap[r.dealer_user_id as string] || "Bayi",
          amount_TRY: Number(r.amount),
          due_date: r.due_date,
          days_overdue: daysOverdue,
        };
      }),
    };
  },
};
