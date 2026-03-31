/**
 * Shared extension token auth — supports both full token and 6-char short code
 */
import { getServiceClient } from "@/platform/auth/supabase";

export async function resolveUserId(token: string): Promise<string | null> {
  const supabase = getServiceClient();

  if (token.length <= 8) {
    // Short code — match first 6 chars case-insensitive
    const { data: rows } = await supabase
      .from("extension_tokens")
      .select("user_id, expires_at, token");
    const match = (rows || []).find(
      r => r.token.substring(0, 6).toUpperCase() === token.toUpperCase(),
    );
    if (!match) return null;
    if (match.expires_at && new Date(match.expires_at) < new Date()) return null;
    return match.user_id;
  }

  // Full token
  const { data } = await supabase
    .from("extension_tokens")
    .select("user_id, expires_at")
    .eq("token", token)
    .single();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  return data.user_id;
}
