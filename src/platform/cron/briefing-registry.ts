/**
 * Cron Briefing Registry — each SaaS registers its own briefing/daily/weekly generators
 *
 * Cron endpoints call getTenantBriefing(tenantKey, userId) etc.
 * Each SaaS provides its own data gathering and formatting.
 */

import { getServiceClient } from "@/platform/auth/supabase";

type BriefingFn = (userId: string, tenantId: string) => Promise<string>;
type DailyCheckFn = (userId: string, tenantId: string, phone: string) => Promise<number>;
type WeeklyReportFn = (userId: string, tenantId: string) => Promise<string>;

const briefings: Record<string, BriefingFn> = {};
const dailyChecks: Record<string, DailyCheckFn> = {};
const weeklyReports: Record<string, WeeklyReportFn> = {};

export function registerBriefing(tenantKey: string, fn: BriefingFn) { briefings[tenantKey] = fn; }
export function registerDailyCheck(tenantKey: string, fn: DailyCheckFn) { dailyChecks[tenantKey] = fn; }
export function registerWeeklyReport(tenantKey: string, fn: WeeklyReportFn) { weeklyReports[tenantKey] = fn; }

export function getBriefingFn(tenantKey: string) { return briefings[tenantKey]; }
export function getDailyCheckFn(tenantKey: string) { return dailyChecks[tenantKey]; }
export function getWeeklyReportFn(tenantKey: string) { return weeklyReports[tenantKey]; }

/** Resolve saas_type from tenant_id */
export async function getTenantKey(tenantId: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data } = await supabase.from("tenants").select("saas_type").eq("id", tenantId).single();
  return data?.saas_type || null;
}
