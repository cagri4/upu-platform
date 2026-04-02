/**
 * Platform Analytics — Event Logger
 *
 * Logs all platform events to the platform_events table for tracking and admin dashboards.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import type { WaContext } from "@/platform/whatsapp/types";

// ── Types ────────────────────────────────────────────────────────────────

export type EventType = "command" | "error" | "onboarding" | "session" | "agent" | "login" | "signup" | "message";

export interface LogEventParams {
  eventType: EventType;
  eventName: string;
  userId?: string;
  tenantId?: string;
  tenantKey?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
  durationMs?: number;
}

// ── Core logger ──────────────────────────────────────────────────────────

export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from("platform_events").insert({
      event_type: params.eventType,
      event_name: params.eventName,
      user_id: params.userId || null,
      tenant_id: params.tenantId || null,
      tenant_key: params.tenantKey || null,
      phone: params.phone || null,
      metadata: params.metadata || {},
      success: params.success ?? true,
      error_message: params.errorMessage || null,
      duration_ms: params.durationMs || null,
    });
  } catch (err) {
    // Never let logging break the main flow
    console.error("[analytics] logEvent error:", err);
  }
}

// ── Convenience: log a command execution ─────────────────────────────────

export async function logCommand(
  ctx: WaContext,
  commandName: string,
  success: boolean = true,
  durationMs?: number,
  error?: string,
): Promise<void> {
  await logEvent({
    eventType: "command",
    eventName: commandName,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    tenantKey: ctx.tenantKey,
    phone: ctx.phone,
    success,
    durationMs,
    errorMessage: error,
    metadata: {
      text: ctx.text?.substring(0, 200),
      interactiveId: ctx.interactiveId,
    },
  });
}

// ── Convenience: log onboarding step ─────────────────────────────────────

export async function logOnboarding(
  ctx: WaContext,
  step: string,
  completed: boolean = false,
): Promise<void> {
  await logEvent({
    eventType: "onboarding",
    eventName: completed ? "onboarding_complete" : `onboarding_step_${step}`,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    tenantKey: ctx.tenantKey,
    phone: ctx.phone,
    metadata: { step, completed },
  });
}

// ── Convenience: log an error ────────────────────────────────────────────

export async function logError(
  ctx: WaContext | { phone: string; userId?: string; tenantId?: string; tenantKey?: string },
  errorMessage: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await logEvent({
    eventType: "error",
    eventName: "error",
    userId: (ctx as WaContext).userId || undefined,
    tenantId: (ctx as WaContext).tenantId || undefined,
    tenantKey: (ctx as WaContext).tenantKey || undefined,
    phone: ctx.phone,
    success: false,
    errorMessage,
    metadata,
  });
}

// ── Convenience: log incoming message ────────────────────────────────────

export async function logMessage(
  ctx: WaContext,
  messageType: string,
): Promise<void> {
  await logEvent({
    eventType: "message",
    eventName: `message_${messageType}`,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    tenantKey: ctx.tenantKey,
    phone: ctx.phone,
    metadata: {
      text: ctx.text?.substring(0, 200),
      interactiveId: ctx.interactiveId,
    },
  });
}

// ── Convenience: log session event ───────────────────────────────────────

export async function logSession(
  ctx: WaContext,
  action: "start" | "end",
): Promise<void> {
  await logEvent({
    eventType: "session",
    eventName: `session_${action}`,
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    tenantKey: ctx.tenantKey,
    phone: ctx.phone,
  });
}
