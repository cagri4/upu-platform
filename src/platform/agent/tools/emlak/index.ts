/**
 * UPU AI Eleman V1 — emlak tool catalog.
 *
 * 5 read-only tool:
 *  - read_portfolio_overview
 *  - read_customers_summary
 *  - read_contracts_recent
 *  - read_tracking_active
 *  - read_calendar_upcoming
 *
 * V1.1 backlog (onay-required action tools): schedule_reminder,
 * flag_customer_priority, generate_property_listing.
 *
 * Filter pattern: emlak tabloları user_id ile filtrelenir (her danışman
 * kendi portföyünü tutar). tenant_id ek katman; user_id zaten profile
 * uniqueness'i sağlar.
 */
import type { ToolDef } from "@/platform/agent/types";
import { readPortfolioOverviewTool } from "./read-portfolio-overview";
import { readCustomersSummaryTool } from "./read-customers-summary";
import { readContractsRecentTool } from "./read-contracts-recent";
import { readTrackingActiveTool } from "./read-tracking-active";
import { readCalendarUpcomingTool } from "./read-calendar-upcoming";

export const EMLAK_TOOLS: ToolDef[] = [
  readPortfolioOverviewTool,
  readCustomersSummaryTool,
  readContractsRecentTool,
  readTrackingActiveTool,
  readCalendarUpcomingTool,
];

export const EMLAK_TOOLS_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  EMLAK_TOOLS.map((t) => [t.name, t]),
);
