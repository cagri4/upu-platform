/**
 * Onboarding Engine — self-setup wizard for new users
 *
 * Each tenant defines an OnboardingFlow with ordered steps.
 * The engine manages state (onboarding_state table), renders questions,
 * processes answers, and advances steps.
 *
 * Flow lifecycle:
 *   initOnboarding() → called after invite code acceptance
 *   getOnboardingState() → checked before normal routing
 *   handleOnboardingInput() → processes user input at current step
 *   completeOnboarding() → marks as done, never shown again
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendText, sendButtons } from "./send";
import type { WaContext } from "./types";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OnboardingStep {
  key: string;
  question: string;                       // Message to show
  buttons?: { id: string; title: string }[]; // Optional button choices
  validate?: (input: string) => boolean;  // Optional validation
  skipLabel?: string;                     // "Atla" button label (null = not skippable)
  onComplete?: (ctx: WaContext, value: string, data: Record<string, unknown>) => Promise<void>;
}

export interface OnboardingFlow {
  tenantKey: string;
  welcomeMessage: string;
  steps: OnboardingStep[];
  onFinish: (ctx: WaContext, data: Record<string, unknown>) => Promise<void>;
}

export interface OnboardingState {
  user_id: string;
  tenant_key: string;
  current_step: string;
  business_info: Record<string, unknown>;
  completed_at: string | null;
}

// ── Flow Registry ──────────────────────────────────────────────────────────

const FLOWS: Record<string, OnboardingFlow> = {};

export function registerOnboardingFlow(flow: OnboardingFlow): void {
  FLOWS[flow.tenantKey] = flow;
}

export function getOnboardingFlow(tenantKey: string): OnboardingFlow | null {
  return FLOWS[tenantKey] || null;
}

// ── State Management ───────────────────────────────────────────────────────

export async function getOnboardingState(userId: string): Promise<OnboardingState | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("onboarding_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function initOnboarding(
  userId: string,
  tenantId: string,
  tenantKey: string,
): Promise<void> {
  const flow = FLOWS[tenantKey];
  if (!flow || flow.steps.length === 0) return;

  const supabase = getServiceClient();

  // Delete any existing onboarding state
  await supabase.from("onboarding_state").delete().eq("user_id", userId);

  await supabase.from("onboarding_state").insert({
    user_id: userId,
    tenant_id: tenantId,
    tenant_key: tenantKey,
    current_step: flow.steps[0].key,
    business_info: {},
  });
}

async function updateOnboardingState(
  userId: string,
  step: string,
  data: Record<string, unknown>,
): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("onboarding_state")
    .update({
      current_step: step,
      business_info: data,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function completeOnboarding(userId: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("onboarding_state")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", userId);
}

// ── Progress Indicator ─────────────────────────────────────────────────────

function progressBar(current: number, total: number): string {
  const filled = "✅".repeat(current);
  const empty = "⬜".repeat(total - current);
  return `${filled}${empty} (${current}/${total})`;
}

// ── Send Current Step ──────────────────────────────────────────────────────

export async function sendOnboardingStep(ctx: WaContext, state: OnboardingState): Promise<void> {
  const flow = FLOWS[state.tenant_key];
  if (!flow) return;

  const stepIndex = flow.steps.findIndex(s => s.key === state.current_step);
  if (stepIndex === -1) return;

  const step = flow.steps[stepIndex];
  const progress = progressBar(stepIndex, flow.steps.length);

  const msg = `🚀 *Kurulum* ${progress}\n\n${step.question}`;

  if (step.buttons && step.buttons.length > 0) {
    // Add skip button if skippable
    const buttons = [...step.buttons];
    if (step.skipLabel !== undefined) {
      buttons.push({ id: "onb:skip", title: step.skipLabel || "Atla" });
    }
    await sendButtons(ctx.phone, msg, buttons.slice(0, 3));
    // If more than 3 buttons, send second message
    if (buttons.length > 3) {
      await sendButtons(ctx.phone, "Diğer seçenekler:", buttons.slice(3, 6));
    }
  } else {
    // Free text input — add skip button if skippable
    if (step.skipLabel !== undefined) {
      await sendButtons(ctx.phone, msg, [
        { id: "onb:skip", title: step.skipLabel || "Atla" },
      ]);
    } else {
      await sendText(ctx.phone, msg);
    }
  }
}

// ── Handle User Input ──────────────────────────────────────────────────────

export async function handleOnboardingInput(ctx: WaContext, state: OnboardingState): Promise<void> {
  const flow = FLOWS[state.tenant_key];
  if (!flow) return;

  const stepIndex = flow.steps.findIndex(s => s.key === state.current_step);
  if (stepIndex === -1) return;

  const step = flow.steps[stepIndex];
  const input = ctx.interactiveId || ctx.text;

  // Cancel onboarding
  const lower = input.toLowerCase().trim();
  if (lower === "iptal" || lower === "vazgeç" || lower === "vazgec") {
    await completeOnboarding(ctx.userId); // Mark as done so it doesn't ask again
    await sendButtons(ctx.phone, "Kurulum atlandı. Daha sonra ayarlardan tamamlayabilirsiniz.\n\nKomutları görmek için menüyü açın.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  // Skip this step
  if (input === "onb:skip") {
    return await advanceToNextStep(ctx, flow, stepIndex, state.business_info);
  }

  // Resolve value from callback or text
  let value = input;
  if (ctx.interactiveId && ctx.interactiveId.startsWith("onb:")) {
    value = ctx.interactiveId.replace("onb:", "");
  }

  // Validate if needed
  if (step.validate && !step.validate(value)) {
    await sendText(ctx.phone, "Geçersiz değer. Lütfen tekrar deneyin.");
    return;
  }

  // Save value
  const updatedData = { ...state.business_info, [step.key]: value };

  // Run step completion hook if any
  if (step.onComplete) {
    await step.onComplete(ctx, value, updatedData);
  }

  // Advance to next step
  await advanceToNextStep(ctx, flow, stepIndex, updatedData);
}

async function advanceToNextStep(
  ctx: WaContext,
  flow: OnboardingFlow,
  currentIndex: number,
  data: Record<string, unknown>,
): Promise<void> {
  const nextIndex = currentIndex + 1;

  if (nextIndex >= flow.steps.length) {
    // All steps done
    await completeOnboarding(ctx.userId);

    // Save business_info to DB
    const supabase = getServiceClient();
    await supabase.from("onboarding_state")
      .update({ business_info: data })
      .eq("user_id", ctx.userId);

    // Run finish hook
    await flow.onFinish(ctx, data);
    return;
  }

  // Move to next step
  const nextStep = flow.steps[nextIndex];
  await updateOnboardingState(ctx.userId, nextStep.key, data);

  // Send next question
  const state: OnboardingState = {
    user_id: ctx.userId,
    tenant_key: flow.tenantKey,
    current_step: nextStep.key,
    business_info: data,
    completed_at: null,
  };
  await sendOnboardingStep(ctx, state);
}
