/**
 * UPU AI Eleman V1 bayi tool catalog.
 *
 * 5 tool:
 *  - list_orders
 *  - get_kpi_summary
 *  - get_account_statement
 *  - list_overdue_invoices
 *  - send_dealer_message (requires confirmation)
 */
import type { ToolDef } from "@/platform/agent/types";
import { listOrdersTool } from "./list-orders";
import { getKpiSummaryTool } from "./get-kpi-summary";
import { getAccountStatementTool } from "./get-account-statement";
import { listOverdueInvoicesTool } from "./list-overdue-invoices";
import { sendDealerMessageTool } from "./send-dealer-message";

export const BAYI_TOOLS: ToolDef[] = [
  listOrdersTool,
  getKpiSummaryTool,
  getAccountStatementTool,
  listOverdueInvoicesTool,
  sendDealerMessageTool,
];

export const BAYI_TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  BAYI_TOOLS.map((t) => [t.name, t]),
);
