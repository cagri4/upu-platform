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
import { BAYI_KURUCU_TOOLS, BAYI_KURUCU_TOOLS_BY_NAME } from "@/platform/agent/tools/bayi-kurucu";
import { BAYI_YONETICI_TOOLS, BAYI_YONETICI_TOOLS_BY_NAME } from "@/platform/agent/tools/bayi-yonetici";
import { buildUpuSystemPrompt, buildUpuEmlakSystemPrompt } from "@/platform/agent/prompt";
import { buildKurucuSystemPrompt } from "@/platform/agent/prompts/bayi-kurucu";
import { buildYoneticiSystemPrompt } from "@/platform/agent/prompts/bayi-yonetici";
import { buildEgitmenSystemPrompt } from "@/platform/agent/prompts/bayi-egitmen";
import type { ToolContext, ToolDef, TenantKey } from "@/platform/agent/types";
import { getOrCreateQuota, incrementQuota, logUsageEvent } from "@/platform/agent/quota";
import { calculateCostUsd } from "@/platform/agent/cost";
import type { SupabaseClient } from "@supabase/supabase-js";

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

const SUPPORTED_TENANTS = new Set<TenantKey>(["bayi", "emlak"]);

function isSupportedTenant(key: string | null | undefined): key is TenantKey {
  return !!key && SUPPORTED_TENANTS.has(key as TenantKey);
}

function getApiKey(tenantKey: TenantKey): string {
  const envKey = tenantKey === "emlak"
    ? (process.env.ANTHROPIC_API_KEY_EMLAK || process.env.ANTHROPIC_API_KEY)
    : (process.env.ANTHROPIC_API_KEY_BAYI || process.env.ANTHROPIC_API_KEY);
  if (!envKey) throw new Error(`ANTHROPIC_API_KEY_${tenantKey.toUpperCase()} env yok.`);
  return envKey;
}

type AgentRoleId = "kurucu" | "yonetici" | "egitmen" | null;

function getToolsForTenant(
  tenantKey: TenantKey,
  agentRole: AgentRoleId = null,
): { list: ToolDef[]; byName: Record<string, ToolDef> } {
  if (tenantKey === "emlak") return { list: EMLAK_TOOLS, byName: EMLAK_TOOLS_BY_NAME };
  if (tenantKey === "bayi") {
    // Faz 3 — rol-bazlı tool seti (KOD DÜZEYİNDE YETKİ SINIRI):
    //   kurucu   → KURUCU_TOOLS    (8 yazma+okuma kurulum tool'u)
    //   yonetici → YONETICI_TOOLS  (8 SALT-OKU; send_dealer_message YOK)
    //   egitmen  → []              (HİÇ tool — sadece anlatım promptu)
    //   null     → BAYI_TOOLS      (backward compat: pre-Faz1C clients)
    if (agentRole === "kurucu") return { list: BAYI_KURUCU_TOOLS, byName: BAYI_KURUCU_TOOLS_BY_NAME };
    if (agentRole === "yonetici") return { list: BAYI_YONETICI_TOOLS, byName: BAYI_YONETICI_TOOLS_BY_NAME };
    if (agentRole === "egitmen") return { list: [], byName: {} };
    return { list: BAYI_TOOLS, byName: BAYI_TOOLS_BY_NAME };
  }
  // Exhaustive: TenantKey union compile-time guard. Runtime defense (yeni tenant
  // tip-listesine eklenip catalog'u eklenmediyse fail fast — sessizce bayi'ye düşmez).
  throw new Error(`Tool catalog yok: ${tenantKey as string}`);
}

/**
 * Defense-in-depth: agent_conversations'a yazmadan önce profile.tenant_id'yi
 * ctx.tenantId ile karşılaştır. Cross-tenant contamination tek satırlık riski
 * burada engellenir; tüm conversation insertleri bu helper'dan geçer.
 *
 * Cost: her save'de 1 profile select. Sohbet başına 2-4 insert; toplam ek
 * round-trip kabul edilebilir (cache layer yok, role/permission değişimleri
 * agresif yansımalı).
 */
async function saveMessage(
  sb: SupabaseClient,
  args: {
    userId: string;
    tenantId: string;
    role: "user" | "assistant" | "tool";
    content: unknown;
    toolUseId?: string;
  },
): Promise<void> {
  const { data: prof, error: profErr } = await sb
    .from("profiles")
    .select("tenant_id")
    .eq("id", args.userId)
    .maybeSingle();
  if (profErr || !prof) {
    throw new Error(`saveMessage: profile yok (${args.userId}).`);
  }
  if (prof.tenant_id !== args.tenantId) {
    throw new Error(
      `saveMessage tenant mismatch: profile.tenant_id=${prof.tenant_id}, ctx.tenantId=${args.tenantId}. ` +
      `Conversation YAZILMADI — cross-tenant contamination engellendi.`,
    );
  }
  const row: Record<string, unknown> = {
    user_id: args.userId,
    tenant_id: args.tenantId,
    role: args.role,
    content: args.content,
  };
  if (args.toolUseId) row.tool_use_id = args.toolUseId;
  const { error } = await sb.from("agent_conversations").insert(row);
  if (error) throw new Error(`saveMessage insert: ${error.message}`);
}

export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenantCfg = getTenantByDomain(host);
  const rawTenantKey = tenantCfg?.key || null;
  // Strict resolve: bilinmeyen tenant → 403 (no fallback to bayi/emlak). Brief
  // gereği — defense-in-depth katmanlarının ilki.
  if (!isSupportedTenant(rawTenantKey)) {
    return NextResponse.json(
      { error: `UPU agent bu domain'de aktif değil (tenant: ${rawTenantKey || "unknown"}).` },
      { status: 403 },
    );
  }
  const tenantKey: TenantKey = rawTenantKey;

  let body: { message?: string; role?: string; context?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Geçersiz JSON." }, { status: 400 });
  }
  const userMessage = (body.message || "").trim();
  if (!userMessage) return NextResponse.json({ error: "message gerekli." }, { status: 400 });
  if (userMessage.length > 4000) {
    return NextResponse.json({ error: "Mesaj çok uzun (max 4000 karakter)." }, { status: 400 });
  }
  // Empty-state / sidebar-help'ten gelen tek-seferlik bağlam (örn.
  // "empty-state:bayi-stok:critical"). Kurucu prompt'unun sonuna
  // HALİHAZIR DURUM satırı yapıştırılır. Sanitize: max 240 char + linefeed
  // kaldır, prompt enjeksiyonu (system override) riski olmasın.
  const ctxRaw = typeof body.context === "string" ? body.context.slice(0, 240) : "";
  const promptContext = ctxRaw.replace(/[\r\n]+/g, " ").trim();
  // Faz 1C: rol bilgisi kabul edilir. Faz 2: rol === 'kurucu' ise
  // Kurucu sistem promptu + Kurucu tool seti aktif. Diğer rolller
  // (yonetici, egitmen) Faz 3'te full implement; şimdilik yonetici
  // mevcut BAYI_TOOLS default davranışına düşer, egitmen ise boş tool
  // seti ile sadece anlatım yapar.
  const VALID_ROLES = new Set(["kurucu", "yonetici", "egitmen"]);
  const agentRole: AgentRoleId = body.role && VALID_ROLES.has(body.role)
    ? body.role as "kurucu" | "yonetici" | "egitmen"
    : null;

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

  // Quota check — limit aşıldıysa 429 + plan + period_end döner
  let quota;
  try {
    quota = await getOrCreateQuota(sb, lookup.profile.id, lookup.tenantId);
  } catch (err) {
    console.error("[agent/chat] quota init err", err);
    return NextResponse.json({ error: "Quota servisi yanıt veremedi." }, { status: 500 });
  }
  if (quota.row.used_messages >= quota.limit) {
    return NextResponse.json({
      error: "quota_exceeded",
      used: quota.row.used_messages,
      limit: quota.limit,
      plan: quota.row.plan_key,
      plan_display: quota.plan_display,
      period_end: quota.row.period_end,
      days_until_reset: quota.days_until_reset,
    }, { status: 429 });
  }

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

  // User mesajı history'e ve DB'ye ekle (integrity check'li save)
  history.push({ role: "user", content: userMessage });
  try {
    await saveMessage(sb, {
      userId: lookup.profile.id,
      tenantId: lookup.tenantId,
      role: "user",
      content: userMessage,
    });
  } catch (err) {
    console.error("[agent/chat] saveMessage user", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const promptInput = {
    displayName: lookup.profile.display_name || "Kullanıcı",
    firmaUnvani,
    role: lookup.profile.role,
  };

  // H-01 güvenlik fix'i (2026-06-11 hardening audit): agentRole client'tan
  // (body.role) geliyor, fakat "kurucu" personası dağıtıcı yönetimiyle AYNI
  // yazma araçlarını taşır (bayi/ürün ekleme, toplu CSV import). Bu yüzden
  // istenen rol, profilin GERÇEK yetkisine göre kısılır — getDagiticiAuth
  // ile simetrik: yalnız admin/user/satis kurucu yazma araçlarına erişir;
  // muhasebe/depocu güvenli şekilde read-only "yonetici" personasına düşer.
  // Aksi halde düşük yetkili bir bayi kullanıcısı {role:"kurucu"} göndererek
  // yönetim yetkisini bypass edebiliyordu (tenant-içi privilege escalation).
  const KURUCU_ALLOWED_ROLES = new Set(["admin", "user", "satis"]);
  const profileRole = (lookup.profile.role || "user").toString();
  let effectiveAgentRole = agentRole;
  if (agentRole === "kurucu" && !KURUCU_ALLOWED_ROLES.has(profileRole)) {
    console.warn(
      `[agent/chat] kurucu personası reddedildi — role='${profileRole}' yetkisiz, yonetici'ye düşürüldü (user=${lookup.profile.id.slice(0, 8)})`,
    );
    effectiveAgentRole = "yonetici";
  }

  // Faz 3F — rol-bazlı sistem promptu (kod düzeyinde tool gating ile
  // simetrik). Her rol kendi karakter+yetki sınırını promptta okur.
  let systemPrompt: string;
  if (tenantKey === "emlak") {
    systemPrompt = buildUpuEmlakSystemPrompt(promptInput);
  } else if (effectiveAgentRole === "kurucu") {
    systemPrompt = buildKurucuSystemPrompt({
      displayName: promptInput.displayName,
      firmaUnvani: promptInput.firmaUnvani,
      // status null — LLM ilk turda kurucu_status tool'u çağırarak alır
      status: null,
      callerContext: promptContext || null,
    });
  } else if (effectiveAgentRole === "yonetici") {
    systemPrompt = buildYoneticiSystemPrompt(promptInput);
  } else if (effectiveAgentRole === "egitmen") {
    systemPrompt = buildEgitmenSystemPrompt({
      displayName: promptInput.displayName,
      firmaUnvani: promptInput.firmaUnvani,
    });
  } else {
    systemPrompt = buildUpuSystemPrompt(promptInput);  // backward compat
  }

  const ctx: ToolContext = {
    sb,
    userId: lookup.profile.id,
    tenantId: lookup.tenantId,
    tenantKey,
    displayName: lookup.profile.display_name,
    role: lookup.profile.role,
  };

  let anthropic: Anthropic;
  try {
    anthropic = new Anthropic({ apiKey: getApiKey(tenantKey) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const { list: TOOL_LIST, byName: TOOL_BY_NAME } = getToolsForTenant(tenantKey, effectiveAgentRole);
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
  // Token + cost accumulators (loop boyunca tüm turn'lerin toplamı)
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;

  // Egitmen rolünde toolDefs boş → Anthropic API tools alanını omit
  // etmek daha güvenli (boş array bazı SDK versiyonlarında validation
  // hatası verebilir). Helper ile koşullu spread.
  const baseCreateParams = (model: string, withCache: boolean) => {
    const sys = withCache
      ? [{ type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const } }]
      : systemPrompt;
    const params: Record<string, unknown> = {
      model,
      max_tokens: 1024,
      system: sys,
      messages: conversation,
    };
    if (toolDefs.length > 0) params.tools = toolDefs;
    if (withCache) params.metadata = { user_id: lookup.profile.id };
    return params;
  };

  try {
    while (turns < MAX_TOOL_TURNS) {
      turns++;
      let response;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response = await anthropic.messages.create(baseCreateParams(usedModel, true) as any);
      } catch (err) {
        // Primary model not found → fallback
        if (usedModel === PRIMARY_MODEL) {
          usedModel = FALLBACK_MODEL;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          response = await anthropic.messages.create(baseCreateParams(usedModel, false) as any);
        } else {
          throw err;
        }
      }

      // Usage accumulation (her turn cumulative)
      const usage = response.usage as {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      totalInput += usage.input_tokens || 0;
      totalOutput += usage.output_tokens || 0;
      totalCacheRead += usage.cache_read_input_tokens || 0;
      totalCacheWrite += usage.cache_creation_input_tokens || 0;

      // Assistant message DB'ye + conversation history'e (integrity check'li)
      await saveMessage(sb, {
        userId: lookup.profile.id,
        tenantId: lookup.tenantId,
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
        // tool_result DB'ye save (integrity check'li)
        await saveMessage(sb, {
          userId: lookup.profile.id,
          tenantId: lookup.tenantId,
          role: "tool",
          content: { tool_name: tu.name, output },
          toolUseId: tu.id,
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

  // Quota + usage track (1 mesaj = 1 chat çağrısı, multi-turn'lerin token toplamı)
  const costUsd = calculateCostUsd(usedModel, totalInput, totalOutput, totalCacheRead, totalCacheWrite);
  try {
    await incrementQuota(sb, lookup.profile.id, quota.row.period_start, {
      input_tokens: totalInput,
      output_tokens: totalOutput,
      cache_read: totalCacheRead,
      cost_usd: costUsd,
    });
    await logUsageEvent(sb, lookup.profile.id, lookup.tenantId, null, usedModel, {
      input_tokens: totalInput,
      output_tokens: totalOutput,
      cache_read: totalCacheRead,
      cache_write: totalCacheWrite,
      cost_usd: costUsd,
      tool_calls: toolCalls.map((tc) => tc.name),
    });
  } catch (err) {
    console.error("[agent/chat] usage track err", err);
  }

  return NextResponse.json({
    ok: true,
    reply: replyText || "(Boş yanıt — tekrar dener misin?)",
    tool_calls: toolCalls,
    turn_count: turns,
    model: usedModel,
    quota: {
      used: quota.row.used_messages + 1,
      limit: quota.limit,
      remaining: Math.max(0, quota.limit - quota.row.used_messages - 1),
    },
  });
}
