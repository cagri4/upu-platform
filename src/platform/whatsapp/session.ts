/**
 * Command session management — multi-step commands (shared across all tenants)
 */

import { getServiceClient } from "@/platform/auth/supabase";

export interface CommandSession {
  id: string;
  user_id: string;
  tenant_id: string;
  command: string;
  current_step: string;
  data: Record<string, unknown>;
}

export async function getSession(userId: string): Promise<CommandSession | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("command_sessions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data && (data as Record<string, unknown>).updated_at) {
    const updatedAt = new Date((data as Record<string, unknown>).updated_at as string).getTime();
    const now = Date.now();
    if (now - updatedAt > 12 * 60 * 60 * 1000) {
      await supabase.from("command_sessions").delete().eq("user_id", userId);
      return null;
    }
  }

  return data;
}

export async function startSession(userId: string, tenantId: string, command: string, step: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("command_sessions").delete().eq("user_id", userId);
  await supabase.from("command_sessions").insert({
    user_id: userId,
    tenant_id: tenantId,
    command,
    current_step: step,
    data: {},
  });
}

export async function updateSession(userId: string, step: string, data: Record<string, unknown>): Promise<void> {
  const supabase = getServiceClient();
  const { data: current } = await supabase
    .from("command_sessions")
    .select("data")
    .eq("user_id", userId)
    .single();

  const merged = { ...(current?.data as Record<string, unknown> || {}), ...data };
  await supabase.from("command_sessions")
    .update({ current_step: step, data: merged, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function endSession(userId: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("command_sessions").delete().eq("user_id", userId);
}
