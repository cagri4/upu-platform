import type { CommandHandler, WaContext } from "./types";
import { sendButtons } from "./send";

/**
 * Creates a placeholder handler for commands that haven't been fully ported yet.
 * Shows which employee handles it and that the feature is coming soon.
 */
export function createPlaceholderHandler(tenantKey: string) {
  return function(command: string, employeeName: string, description: string): CommandHandler {
    return async (ctx: WaContext) => {
      await sendButtons(ctx.phone,
        `${employeeName} — ${description}\n\nBu komut yakında aktif olacak.`,
        [{ id: "cmd:menu", title: "Ana Menü" }],
      );
    };
  };
}
