/**
 * Cron: Agent Run — runs all autonomous agents for emlak users with briefing enabled
 * Schedule: 0 7 * * * (07:00 UTC = 10:00 Turkey)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { runAllAgents } from "@/platform/agents/engine";
import { emlakAgents } from "@/tenants/emlak/agents";
import { siteyonetimAgents } from "@/tenants/siteyonetim/agents";
import { bayiAgents } from "@/tenants/bayi/agents";
import { otelAgents } from "@/tenants/otel/agents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Get all users with briefing enabled
  const { data: users } = await supabase
    .from("profiles")
    .select("id, tenant_id, whatsapp_phone, display_name")
    .not("whatsapp_phone", "is", null)
    .eq("metadata->>briefing_enabled", "true");

  if (!users?.length) return NextResponse.json({ ok: true, processed: 0 });

  // Filter to emlak tenant
  const emlakTenantId = "3f3598fc-a93e-4c73-bd33-7c4217f6c089";
  const emlakUsers = users.filter((u) => u.tenant_id === emlakTenantId);

  for (const user of emlakUsers) {
    try {
      await runAllAgents(emlakAgents, {
        userId: user.id,
        tenantId: user.tenant_id,
        phone: user.whatsapp_phone,
        userName: user.display_name || "",
      });
    } catch (err) {
      console.error(`[agent-run] error for ${user.id}:`, err);
    }
  }

  // ── Site Yonetim agents ──
  const syTenantId = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";
  const syUsers = users.filter((u) => u.tenant_id === syTenantId);

  for (const user of syUsers) {
    try {
      await runAllAgents(siteyonetimAgents, {
        userId: user.id,
        tenantId: user.tenant_id,
        phone: user.whatsapp_phone,
        userName: user.display_name || "",
      });
    } catch (err) {
      console.error(`[agent-run] sy error for ${user.id}:`, err);
    }
  }

  // ── Bayi agents ──
  const bayiTenantId = "32f5feda-700f-44c6-a270-5bbb5a040994";
  const bayiUsers = users.filter((u) => u.tenant_id === bayiTenantId);

  for (const user of bayiUsers) {
    try {
      await runAllAgents(bayiAgents, {
        userId: user.id,
        tenantId: user.tenant_id,
        phone: user.whatsapp_phone,
        userName: user.display_name || "",
      });
    } catch (err) {
      console.error(`[agent-run] bayi error for ${user.id}:`, err);
    }
  }

  // ── Otel agents ──
  const otelTenantId = "16871326-afef-4ba3-a079-2c5ede8fac4d";
  const otelUsers = users.filter((u) => u.tenant_id === otelTenantId);

  for (const user of otelUsers) {
    try {
      await runAllAgents(otelAgents, {
        userId: user.id,
        tenantId: user.tenant_id,
        phone: user.whatsapp_phone,
        userName: user.display_name || "",
      });
    } catch (err) {
      console.error(`[agent-run] otel error for ${user.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, processed: emlakUsers.length + syUsers.length + bayiUsers.length + otelUsers.length });
}
