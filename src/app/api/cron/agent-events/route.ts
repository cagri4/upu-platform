/**
 * Process agent events — triggered by DB changes (INSERT/UPDATE triggers)
 * Maps source_table to agent_key, creates tasks, runs cycles.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { runAgent } from "@/platform/agents/engine";
import type { AgentDefinition } from "@/platform/agents/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// source_table → agent_key mapping
const TABLE_AGENT_MAP: Record<string, string[]> = {
  reminders: ["sekreter"],
  contracts: ["sekreter"],
  emlak_properties: ["portfoy"],
  emlak_customers: ["satis"],
  mkt_products: ["mkt_stokSorumlusu"],
  mkt_orders: ["mkt_siparisYoneticisi"],
  mkt_sales: ["mkt_finansAnalisti"],
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  let processed = 0;

  try {
    // Get unprocessed events
    const { data: events } = await supabase
      .from("agent_events")
      .select("*")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(50);

    if (!events?.length) return NextResponse.json({ ok: true, processed: 0 });

    for (const event of events) {
      try {
        const agentKeys = TABLE_AGENT_MAP[event.source_table] || [];
        if (agentKeys.length === 0 || !event.user_id) {
          // Mark as processed even if no agent
          await supabase.from("agent_events").update({ processed: true }).eq("id", event.id);
          processed++;
          continue;
        }

        // Get user info
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, tenant_id, whatsapp_phone, display_name")
          .eq("id", event.user_id)
          .maybeSingle();

        if (!profile?.whatsapp_phone) {
          await supabase.from("agent_events").update({ processed: true }).eq("id", event.id);
          processed++;
          continue;
        }

        // Resolve tenant key
        const { data: tenant } = await supabase
          .from("tenants")
          .select("saas_type")
          .eq("id", profile.tenant_id)
          .single();

        if (!tenant) {
          await supabase.from("agent_events").update({ processed: true }).eq("id", event.id);
          processed++;
          continue;
        }

        // Load tenant agents
        let agents: Record<string, AgentDefinition> = {};
        if (tenant.saas_type === "emlak") {
          const { emlakAgents } = await import("@/tenants/emlak/agents");
          agents = emlakAgents;
        } else if (tenant.saas_type === "siteyonetim") {
          const { siteyonetimAgents } = await import("@/tenants/siteyonetim/agents");
          agents = siteyonetimAgents;
        } else if (tenant.saas_type === "bayi") {
          const { bayiAgents } = await import("@/tenants/bayi/agents");
          agents = bayiAgents;
        } else if (tenant.saas_type === "muhasebe") {
          const { muhasebeAgents } = await import("@/tenants/muhasebe/agents");
          agents = muhasebeAgents;
        } else if (tenant.saas_type === "otel") {
          const { otelAgents } = await import("@/tenants/otel/agents");
          agents = otelAgents;
        } else if (tenant.saas_type === "market") {
          const { marketAgents } = await import("@/tenants/market/agents");
          agents = marketAgents;
        }

        const ctx = {
          userId: profile.id,
          tenantId: profile.tenant_id,
          phone: profile.whatsapp_phone,
          userName: profile.display_name || "",
        };

        // Run relevant agents
        for (const agentKey of agentKeys) {
          const agent = agents[agentKey];
          if (agent) {
            await runAgent(agent, ctx, "webhook", {
              event_type: event.event_type,
              source_table: event.source_table,
              source_id: event.source_id,
            });
          }
        }

        // Mark processed
        await supabase.from("agent_events").update({ processed: true }).eq("id", event.id);
        processed++;
      } catch (err) {
        console.error(`[cron:agent-events] Error processing event ${event.id}:`, err);
        await supabase.from("agent_events").update({ processed: true }).eq("id", event.id);
        processed++;
      }
    }
  } catch (err) {
    console.error("[cron:agent-events] Fatal:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, processed });
}
