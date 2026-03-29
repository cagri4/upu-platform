/**
 * Agent Setup Engine — each virtual employee asks user preferences on first interaction
 *
 * Flow: user selects employee → no config? → setup questions → save config → ready
 * Config stored in agent_config table, used by agent engine during autonomous runs.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";
import { startSession, updateSession, endSession, getSession } from "@/platform/whatsapp/session";

// ── Types ──────────────────────────────────────────────────────────────

export interface SetupQuestion {
  key: string;
  text: string;
  buttons?: { id: string; title: string }[];
  listRows?: { id: string; title: string; description?: string }[];
  listButtonText?: string;
  freeText?: boolean;
  defaultValue?: string;
}

export interface AgentSetupFlow {
  agentKey: string;
  agentName: string;
  agentIcon: string;
  greeting: string;
  questions: SetupQuestion[];
  onComplete: (config: Record<string, string>) => string; // summary message
}

// ── Registry ───────────────────────────────────────────────────────────

const SETUP_FLOWS: Record<string, AgentSetupFlow> = {};

export function registerAgentSetup(flow: AgentSetupFlow): void {
  SETUP_FLOWS[flow.agentKey] = flow;
}

export function getAgentSetup(agentKey: string): AgentSetupFlow | null {
  return SETUP_FLOWS[agentKey] || null;
}

// ── Config Check ───────────────────────────────────────────────────────

export async function isAgentConfigured(userId: string, agentKey: string): Promise<boolean> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("agent_config")
    .select("setup_completed")
    .eq("user_id", userId)
    .eq("agent_key", agentKey)
    .maybeSingle();
  return data?.setup_completed === true;
}

export async function getAgentConfig(userId: string, agentKey: string): Promise<Record<string, unknown> | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("agent_config")
    .select("config")
    .eq("user_id", userId)
    .eq("agent_key", agentKey)
    .eq("setup_completed", true)
    .maybeSingle();
  return data?.config as Record<string, unknown> | null;
}

// ── Start Setup ────────────────────────────────────────────────────────

export async function startAgentSetup(ctx: WaContext, agentKey: string): Promise<void> {
  const flow = SETUP_FLOWS[agentKey];
  if (!flow || flow.questions.length === 0) return;

  await startSession(ctx.userId, ctx.tenantId, `agent_setup_${agentKey}`, flow.questions[0].key);

  await sendText(ctx.phone, `${flow.agentIcon} *${flow.agentName}*\n\n${flow.greeting}`);

  await sendSetupQuestion(ctx, flow, 0);
}

// ── Send Question ──────────────────────────────────────────────────────

async function sendSetupQuestion(ctx: WaContext, flow: AgentSetupFlow, index: number): Promise<void> {
  const q = flow.questions[index];
  const progress = `(${index + 1}/${flow.questions.length})`;
  const msg = `${progress} ${q.text}`;

  if (q.buttons && q.buttons.length > 0) {
    const btns = q.buttons.map(b => ({
      id: `asetup:${b.id}`,
      title: b.title.substring(0, 20),
    }));
    await sendButtons(ctx.phone, msg, btns.slice(0, 3));
    if (btns.length > 3) {
      await sendButtons(ctx.phone, "Diğer seçenekler:", btns.slice(3, 6));
    }
  } else if (q.listRows && q.listRows.length > 0) {
    const rows = q.listRows.map(r => ({
      id: `asetup:${r.id}`,
      title: r.title.substring(0, 24),
      description: r.description,
    }));
    await sendList(ctx.phone, msg, q.listButtonText || "Seçin", [{ title: "Seçenekler", rows }]);
  } else {
    await sendText(ctx.phone, msg);
  }
}

// ── Handle Setup Input ─────────────────────────────────────────────────

export async function handleAgentSetupInput(ctx: WaContext): Promise<boolean> {
  const session = await getSession(ctx.userId);
  if (!session || !session.command.startsWith("agent_setup_")) return false;

  const agentKey = session.command.replace("agent_setup_", "");
  const flow = SETUP_FLOWS[agentKey];
  if (!flow) {
    await endSession(ctx.userId);
    return true;
  }

  const currentIndex = flow.questions.findIndex(q => q.key === session.current_step);
  if (currentIndex === -1) {
    await endSession(ctx.userId);
    return true;
  }

  // Get input value
  let value = ctx.text.trim();
  if (ctx.interactiveId && ctx.interactiveId.startsWith("asetup:")) {
    value = ctx.interactiveId.replace("asetup:", "");
  }

  // Cancel
  const lower = value.toLowerCase();
  if (lower === "iptal" || lower === "vazgeç" || lower === "vazgec") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "Kurulum atlandı. Daha sonra tekrar başlatabilirsiniz.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return true;
  }

  // Save answer
  const answers = { ...(session.data as Record<string, unknown>), [flow.questions[currentIndex].key]: value };

  // Next question or complete
  const nextIndex = currentIndex + 1;
  if (nextIndex >= flow.questions.length) {
    // Setup complete — save to DB
    await endSession(ctx.userId);
    const supabase = getServiceClient();
    await supabase.from("agent_config").upsert({
      user_id: ctx.userId,
      agent_key: agentKey,
      config: answers,
      setup_completed: true,
      updated_at: new Date().toISOString(),
    });

    const summary = flow.onComplete(answers as Record<string, string>);
    await sendButtons(ctx.phone,
      `${flow.agentIcon} *${flow.agentName} — Kurulum Tamamlandı!*\n\n${summary}\n\nArtık otonom çalışmaya başlıyorum.`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
    return true;
  }

  // Advance to next question
  await updateSession(ctx.userId, flow.questions[nextIndex].key, answers);
  await sendSetupQuestion(ctx, flow, nextIndex);
  return true;
}
