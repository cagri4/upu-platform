/**
 * UPU AI Eleman bayi tool catalog.
 *
 * 7 tool:
 *  - list_orders
 *  - get_kpi_summary
 *  - get_account_statement
 *  - list_overdue_invoices
 *  - send_dealer_message (requires confirmation)
 *  - get_dealer_score (Faz A — 3.1)
 *  - get_churn_risks (Faz A — 3.2)
 */
import type { ToolDef } from "@/platform/agent/types";
import { listOrdersTool } from "./list-orders";
import { getKpiSummaryTool } from "./get-kpi-summary";
import { getAccountStatementTool } from "./get-account-statement";
import { listOverdueInvoicesTool } from "./list-overdue-invoices";
import { sendDealerMessageTool } from "./send-dealer-message";
import { getDealerScoreTool } from "./get-dealer-score";
import { getChurnRisksTool } from "./get-churn-risks";

export const BAYI_TOOLS: ToolDef[] = [
  listOrdersTool,
  getKpiSummaryTool,
  getAccountStatementTool,
  listOverdueInvoicesTool,
  sendDealerMessageTool,
  getDealerScoreTool,
  getChurnRisksTool,
];

export const BAYI_TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  BAYI_TOOLS.map((t) => [t.name, t]),
);
