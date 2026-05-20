import { assertTenant, type ToolDef } from "@/platform/agent/types";

export const getAccountStatementTool: ToolDef = {
  name: "get_account_statement",
  description: "Bayi cari ekstresini döner: hareketler (sipariş/fatura borç + tahsilat alacak) + opening/closing bakiye + debit/credit toplamları. Müşteri 'bakiye ne kadar' veya 'cari özet' sorduğunda kullan.",
  expectedTenantKey: "bayi",
  input_schema: {
    type: "object",
    properties: {
      dealer_id: {
        type: "string",
        description: "Admin/muhasebe için hangi bayi. Bayi rolünde otomatik kendisi.",
      },
      from: { type: "string", description: "Başlangıç tarihi YYYY-MM-DD (opsiyonel)." },
      to: { type: "string", description: "Bitiş tarihi YYYY-MM-DD (opsiyonel)." },
      limit: { type: "number", description: "Maks satır (default 20)." },
    },
  },
  async handler(input, ctx) {
    assertTenant(ctx, "bayi", "get_account_statement");
    const isAdmin = ["admin", "muhasebe"].includes(ctx.role || "");
    const dealerId = isAdmin
      ? ((input.dealer_id as string | undefined) || ctx.userId)
      : ctx.userId;
    const limit = Math.min(100, Number(input.limit) || 20);
    const from = input.from as string | undefined;
    const to = input.to as string | undefined;

    let openingDebit = 0;
    let openingCredit = 0;
    if (from) {
      const { data: opening } = await ctx.sb
        .from("bayi_account_statement")
        .select("debit, credit")
        .eq("tenant_id", ctx.tenantId)
        .eq("dealer_user_id", dealerId)
        .lt("entry_date", from);
      for (const r of opening || []) {
        openingDebit += Number(r.debit) || 0;
        openingCredit += Number(r.credit) || 0;
      }
    }

    let query = ctx.sb
      .from("bayi_account_statement")
      .select("entry_type, reference_id, entry_date, debit, credit, description")
      .eq("tenant_id", ctx.tenantId)
      .eq("dealer_user_id", dealerId)
      .order("entry_date", { ascending: false })
      .limit(limit);
    if (from) query = query.gte("entry_date", from);
    if (to) query = query.lte("entry_date", `${to}T23:59:59`);

    const { data, error } = await query;
    if (error) return { error: "Ekstre alınamadı: " + error.message };

    const opening = openingDebit - openingCredit;
    let debitTotal = 0;
    let creditTotal = 0;
    for (const r of data || []) {
      debitTotal += Number(r.debit) || 0;
      creditTotal += Number(r.credit) || 0;
    }
    const closing = opening + debitTotal - creditTotal;

    return {
      dealer_id: dealerId,
      opening_balance_TRY: opening,
      debit_total_TRY: debitTotal,
      credit_total_TRY: creditTotal,
      closing_balance_TRY: closing,
      rows: (data || []).map((r) => ({
        date: r.entry_date,
        type: r.entry_type,
        description: r.description,
        debit: Number(r.debit) || 0,
        credit: Number(r.credit) || 0,
      })),
    };
  },
};
