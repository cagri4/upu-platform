/**
 * Platform notification fan-out — deliver a WhatsApp message to every
 * user in a tenant who has a given capability.
 *
 * Used by event-based triggers (e.g. on new order → notify users with
 * stock:edit). Also exposed to cron jobs that want to push proactive
 * alerts. Wildcard "*" in a user's capability list counts as having
 * the capability.
 */

import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons, sendText } from "@/platform/whatsapp/send";

export interface NotifyOptions {
  excludeUserId?: string;
  buttons?: Array<{ id: string; title: string }>;
  limit?: number;
}

/**
 * Send a WhatsApp message to every user in `tenantId` whose
 * capabilities array contains `capability` (or "*"). Returns the number
 * of deliveries attempted. Errors per-recipient are swallowed and
 * logged — fan-out must not fail because one send threw.
 */
export async function notifyUsersByCapability(
  tenantId: string,
  capability: string,
  message: string,
  opts: NotifyOptions = {},
): Promise<number> {
  const supabase = getServiceClient();

  // Two queries OR'd: users with wildcard OR users with this specific
  // capability. Supabase doesn't let us OR contains() so we fetch both
  // and merge by id.
  const [{ data: wildcard }, { data: specific }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, whatsapp_phone")
      .eq("tenant_id", tenantId)
      .contains("capabilities", ["*"])
      .not("whatsapp_phone", "is", null),
    supabase
      .from("profiles")
      .select("id, whatsapp_phone")
      .eq("tenant_id", tenantId)
      .contains("capabilities", [capability])
      .not("whatsapp_phone", "is", null),
  ]);

  const seen = new Set<string>();
  const recipients: Array<{ id: string; phone: string }> = [];
  for (const list of [wildcard || [], specific || []]) {
    for (const row of list) {
      if (!row.id || !row.whatsapp_phone) continue;
      if (seen.has(row.id)) continue;
      if (opts.excludeUserId && row.id === opts.excludeUserId) continue;
      seen.add(row.id);
      recipients.push({ id: row.id, phone: row.whatsapp_phone });
    }
  }

  const limited = opts.limit ? recipients.slice(0, opts.limit) : recipients;
  let sent = 0;
  for (const r of limited) {
    try {
      if (opts.buttons && opts.buttons.length > 0) {
        await sendButtons(r.phone, message, opts.buttons);
      } else {
        await sendText(r.phone, message);
      }
      sent++;
    } catch (err) {
      console.error(`[notifyUsersByCapability] send failed to ${r.phone}:`, err);
    }
  }
  return sent;
}
