/**
 * POST /api/agent/chat
 *
 * UPU AI Eleman V1 — non-streaming agent loop (MVP).
 * Body: { message: string }
 * Response: { reply: string, tool_calls: [{ name, input, output }], turn_count }
 *
 * Akış:
 *   1. resolvePanelAuth + tenant profile → ctx (userId, tenantId, role)
 *   2. agent_profiles upsert (display_name + last_active)
 *   3. agent_conversations last 20 message hydrate
 *   4. User message DB'ye save
 *   5. Anthropic message create loop (tool_use → handler → tool_result)
 *   6. Assistant final text + tool_use'ler + tool_result'ler DB'ye save
 *   7. Reply JSON döner
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { getTenantByDomain } from "@/tenants/config";
import { BAYI_TOOLS, BAYI_TOOLS_BY_NAME } from "@/platform/agent/tools/bayi";
import { EMLAK_TOOLS, EMLAK_TOOLS_BY_NAME } from "@/platform/agent/tools/emlak";
import { buildUpuSystemPrompt, buildUpuEmlakSystemPrompt } from "@/platform/agent/prompt";
import type { ToolContext, ToolDef } from "@/platform/agent/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRIMARY_MODEL = "claude-sonnet-4-6";
const FALLBACK_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOOL_TURNS = 5;

interface DbMessageRow {
  role: "user" | "assistant" | "tool";
  content: unknown;
  tool_use_id: string | null;
}

const SUPPORTED_TENANTS = new Set(["bayi", "emlak"]);

function getApiKey(tenantKey: string): string {
  const envKey = tenantKey === "emlak"
    ? (process.env.ANTHROPIC_API_KEY_EMLAK || process.env.ANTHROPIC_API_KEY)
    : (process.env.ANTHROPIC_API_KEY_BAYI || process.env.ANTHROPIC_API_KEY);
  if (!envKey) throw new Error(`ANTHROPIC_API_KEY_${tenantKey.toUpperCase()} env yok.`);
  return envKey;
}

function getToolsForTenant(tenantKey: string): { list: ToolDef[]; byName: Record<string, ToolDef> } {
  if (tenantKey === "emlak") return { list: EMLAK_TOOLS, byName: EMLAK_TOOLS_BY_NAME };
  return { list: BAYI_TOOLS, byName: BAYI_TOOLS_BY_NAME };
}

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenantCfg = getTenantByDomain(host);
  const tenantKey = tenantCfg?.key || null;
  if (!tenantKey || !SUPPORTED_TENANTS.has(tenantKey)) {
    return NextResponse.json(
      { error: "Bu subdomain'de UPU agent desteği yok." },
      { status: 400 },
    );
  }

  let body: { message?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }
  const userMessage = (body.message || "").trim();
  if (!userMessage) return NextResponse.json({ error: "message gerekli." }, { status: 400 });
  if (userMessage.length > 4000) {
    return NextResponse.json({ error: "Mesaj çok uzun (max 4000 karakter)." }, { status: 400 });
  }

  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{
    display_name: string | null;
    metadata: Record<string, unknown> | null;
    role: string | null;
  }>(sb, {
    userId: auth.userId,
    tenantKey,
    select: "id, display_name, metadata, role",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const meta = (lookup.profile.metadata as Record<string, unknown>) || {};
  const firma = (meta.firma_profili as { ticari_unvan?: string } | null) || null;
  const firmaUnvani = firma?.ticari_unvan || (meta.company_name as string) || null;

  // Upsert agent_profiles
  await sb.from("agent_profiles").upsert({
    user_id: lookup.profile.id,
    tenant_id: lookup.tenantId,
    display_name: lookup.profile.display_name,
    last_active: new Date().toISOString(),
  }, { onConflict: "user_id" });

  // History (son 20 mesaj — assistant + user + tool)
  const { data: historyRows } = await sb
    .from("agent_conversations")
    .select("role, content, tool_use_id")
    .eq("user_id", lookup.profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const history = ((historyRows || []) as DbMessageRow[])
    .reverse()
    .map((r) => {
      if (r.role === "tool") {
        return {
          role: "user" as const,
          content: [{
            type: "tool_result",
            tool_use_id: r.tool_use_id || "",
            content: typeof r.content === "string" ? r.content : JSON.stringify(r.content),
          }],
        };
      }
      return {
        role: r.role,
        content: r.content,
      };
    });

  // User mesajı history'e ve DB'ye ekle
  history.push({ role: "user", content: userMessage });
  await sb.from("agent_conversations").insert({
    user_id: lookup.profile.id,
    tenant_id: lookup.tenantId,
    role: "user",
    content: userMessage,
  });

  const promptInput = {
    displayName: lookup.profile.display_name || "Kullanıcı",
    firmaUnvani,
    role: lookup.profile.role,
  };
  const systemPrompt = tenantKey === "emlak"
    ? buildUpuEmlakSystemPrompt(promptInput)
    : buildUpuSystemPrompt(promptInput);

  const ctx: ToolContext = {
    sb,
    userId: lookup.profile.id,
    tenantId: lookup.tenantId,
    displayName: lookup.profile.display_name,
    role: lookup.profile.role,
  };

  let anthropic: Anthropic;
  try {
    anthropic = new Anthropic({ apiKey: getApiKey(tenantKey) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const { list: TOOL_LIST, byName: TOOL_BY_NAME } = getToolsForTenant(tenantKey);
  const toolDefs = TOOL_LIST.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  // Agent loop
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversation: any[] = [...history];
  const toolCalls: Array<{ name: string; input: unknown; output: unknown }> = [];
  let replyText = "";
  let turns = 0;
  let usedModel = PRIMARY_MODEL;

  try {
    while (turns < MAX_TOOL_TURNS) {
      turns++;
      let response;
      try {
        response = await anthropic.messages.create({
          model: usedModel,
          max_tokens: 1024,
          system: [{
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          }],
          tools: toolDefs,
          messages: conversation,
          metadata: { user_id: lookup.profile.id },
        });
      } catch (err) {
        // Primary model not found → fallback
        if (usedModel === PRIMARY_MODEL) {
          usedModel = FALLBACK_MODEL;
          response = await anthropic.messages.create({
            model: usedModel,
            max_tokens: 1024,
            system: systemPrompt,
            tools: toolDefs,
            messages: conversation,
          });
        } else {
          throw err;
        }
      }

      // Assistant message DB'ye + conversation history'e
      await sb.from("agent_conversations").insert({
        user_id: lookup.profile.id,
        tenant_id: lookup.tenantId,
        role: "assistant",
        content: response.content,
      });
      conversation.push({ role: "assistant", content: response.content });

      // Text content + tool_use ayır
      const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      for (const block of response.content) {
        if (block.type === "text") {
          replyText += (replyText ? "\n\n" : "") + block.text;
        } else if (block.type === "tool_use") {
          toolUses.push({
            id: block.id,
            name: block.name,
            input: (block.input as Record<string, unknown>) || {},
          });
        }
      }

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      // Tool'ları çalıştır + tool_result hazırla
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const tool = TOOL_BY_NAME[tu.name];
        let output: unknown;
        if (!tool) {
          output = { error: `Bilinmeyen tool: ${tu.name}` };
        } else {
          try {
            output = await tool.handler(tu.input, ctx);
          } catch (err) {
            output = { error: (err as Error).message };
          }
        }

        toolCalls.push({ name: tu.name, input: tu.input, output });

        const outputStr = JSON.stringify(output);
        // tool_result DB'ye save
        await sb.from("agent_conversations").insert({
          user_id: lookup.profile.id,
          tenant_id: lookup.tenantId,
          role: "tool",
          content: { tool_name: tu.name, output },
          tool_use_id: tu.id,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: outputStr,
        });
      }

      conversation.push({ role: "user", content: toolResults });
    }
  } catch (err) {
    console.error("[agent/chat]", err);
    return NextResponse.json({
      error: "AI yanıt veremedi: " + (err as Error).message,
    }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    reply: replyText || "(Boş yanıt — tekrar dener misin?)",
    tool_calls: toolCalls,
    turn_count: turns,
    model: usedModel,
  });
}
