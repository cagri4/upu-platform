/**
 * Cron: Agent Run — runs all autonomous agents for emlak users with briefing enabled
 * Schedule: 0 7 * * * (07:00 UTC = 10:00 Turkey)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { runAllAgents } from "@/platform/agents/engine";
import { emlakAgents } from "@/tenants/emlak/agents";

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

  return NextResponse.json({ ok: true, processed: emlakUsers.length });
}
