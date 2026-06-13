/**
 * POST /api/otel-panel/agent-chat — Otel AI Asistan chat (Faz 5)
 *
 * Body: { message: string, conversation_id?: string }
 * Response: { reply, tool_calls, conversation_id }
 *
 * Akış:
 *   1. requireAuthFromBody + otel scope check (otel_user_hotels)
 *   2. Bilgi bankası (otel_agent_knowledge) → prompt'a ekle
 *   3. otel_agent_approvals.pending count → prompt
 *   4. Anthropic call + tool loop (otel/index.ts'teki 5 tool)
 *   5. agent_conversations'a kaydet (user + assistant + tool result)
 *   6. Yanıt JSON döner
 *
 * NOT: Mevcut /api/agent/chat bayi+emlak için. Otel ayrı endpoint —
 * SUPPORTED_TENANTS'a otel eklemek mevcut prompt/catalog routing'i
 * karıştırırdı. Pilot için ayrı tut, V2'de tek endpoint'e birleştir.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";
import { buildOtelAsistanPrompt } from "@/platform/agent/prompts/otel-asistan";
import { otelTools, type OtelToolContext } from "@/platform/agent/tools/otel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PRIMARY_MODEL = "claude-sonnet-4-6";
const MAX_TOOL_TURNS = 5;

interface ChatBody {
  message?: string;
  token?: string | null;
}

export async function POST(req: NextRequest) {
  const body: ChatBody = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const message = (body.message || "").trim();
  if (!message) return NextResponse.json({ error: "message gerekli" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY_OTEL || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI servisi yapılandırılmamış" }, { status: 503 });

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string; tenant_id: string; display_name: string | null }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id, tenant_id, display_name",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: ouh } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .limit(1)
    .maybeSingle();
  if (!ouh?.hotel_id) return NextResponse.json({ error: "Otel atanmamış" }, { status: 403 });

  const hotelId = ouh.hotel_id;

  const { data: hotel } = await sb
    .from("otel_hotels")
    .select("id, name, metadata, public_settings")
    .eq("id", hotelId)
    .single();

  // Bilgi bankası
  const { data: knowledgeRows } = await sb
    .from("otel_agent_knowledge")
    .select("title, content, category")
    .eq("hotel_id", hotelId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(50);

  const knowledgeBase = (knowledgeRows || [])
    .map(k => `### ${k.title}\n${k.content}`)
    .join("\n\n")
    .slice(0, 3000);

  const { count: pendingCount } = await sb
    .from("otel_agent_approvals")
    .select("*", { count: "exact", head: true })
    .eq("hotel_id", hotelId)
    .eq("status", "pending");

  const systemPrompt = buildOtelAsistanPrompt({
    hotelName: hotel?.name || "—",
    hotelLocation: (hotel?.metadata as any)?.location || (hotel?.public_settings as any)?.address || null,
    knowledgeBase,
    pendingApprovalsCount: pendingCount || 0,
  });

  // Anthropic tools spec
  const tools = otelTools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as any,
  }));

  const anthropic = new Anthropic({ apiKey });
  const toolCtx: OtelToolContext = { sb, hotelId, userId: lookup.profile.id };

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: message },
  ];

  const allToolCalls: Array<{ name: string; input: any; output: any }> = [];
  let finalReply = "";
  let turn = 0;

  while (turn < MAX_TOOL_TURNS) {
    turn++;
    const resp = await anthropic.messages.create({
      model: PRIMARY_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    });

    const toolUses = resp.content.filter((b: any) => b.type === "tool_use") as Anthropic.Messages.ToolUseBlock[];
    const texts = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
    if (texts) finalReply = texts;

    if (toolUses.length === 0) break;

    // Tool result hazırla
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const tool = otelTools.find(t => t.name === tu.name);
      let result: any;
      if (!tool) {
        result = { error: `Tool yok: ${tu.name}` };
      } else {
        try {
          result = await tool.handler(toolCtx, tu.input as any);
        } catch (e: any) {
          result = { error: e?.message || "Tool çağrı hatası" };
        }
      }
      allToolCalls.push({ name: tu.name, input: tu.input, output: result });
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result),
      });
    }

    // Assistant response'u + tool results'ı messages'a ekle
    messages.push({ role: "assistant", content: resp.content });
    messages.push({ role: "user", content: toolResults });
  }

  // agent_conversations log (basit save)
  try {
    await sb.from("agent_conversations").insert([
      { tenant_id: lookup.tenantId, user_id: lookup.profile.id, role: "user", content: { text: message } },
      { tenant_id: lookup.tenantId, user_id: lookup.profile.id, role: "assistant",
        content: { text: finalReply, tool_calls: allToolCalls } },
    ]);
  } catch {
    // best effort
  }

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({
    success: true,
    reply: finalReply,
    tool_calls: allToolCalls,
  });
}
