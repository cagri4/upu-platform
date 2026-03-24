/**
 * Central Command Router — routes WhatsApp commands to tenant-specific handlers
 */

import type { WaContext, TenantCommandRegistry } from "./types";
import { getSession } from "./session";
import { sendText, sendButtons } from "./send";
import { emlakCommands } from "@/tenants/emlak/commands";
import { bayiCommands } from "@/tenants/bayi/commands";
import { muhasebeCommands } from "@/tenants/muhasebe/commands";
import { otelCommands } from "@/tenants/otel/commands";
import { siteyonetimCommands } from "@/tenants/siteyonetim/commands";
import { getTenantByKey } from "@/tenants/config";

// ── Registry per tenant ──────────────────────────────────────────────────

const REGISTRIES: Record<string, TenantCommandRegistry> = {
  emlak: emlakCommands,
  bayi: bayiCommands,
  muhasebe: muhasebeCommands,
  otel: otelCommands,
  siteyonetim: siteyonetimCommands,
};

// ── Main router ──────────────────────────────────────────────────────────

export async function routeCommand(ctx: WaContext): Promise<void> {
  const registry = REGISTRIES[ctx.tenantKey];
  if (!registry) {
    await sendText(ctx.phone, "Bu SaaS için komut sistemi henüz kurulmamış.");
    return;
  }

  const tenant = getTenantByKey(ctx.tenantKey);

  // ── Check for active session (multi-step command) ──
  const session = await getSession(ctx.userId);
  if (session) {
    // Cancel keywords
    const lower = ctx.text.toLowerCase().trim();
    if (lower === "iptal" || lower === "vazgeç" || lower === "vazgec") {
      const { endSession } = await import("./session");
      await endSession(ctx.userId);
      await sendButtons(ctx.phone, "❌ İşlem iptal edildi.", [
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    // Route to step handler
    const stepHandler = registry.stepHandlers[session.command];
    if (stepHandler) {
      await stepHandler(ctx, session);
      return;
    }
  }

  // ── Check for callback (interactive button/list reply) ──
  if (ctx.interactiveId) {
    // Platform-level callbacks
    if (ctx.interactiveId.startsWith("cmd:")) {
      const cmd = ctx.interactiveId.replace("cmd:", "");
      if (cmd === "menu") {
        await showMenu(ctx, tenant, registry);
        return;
      }
      const handler = registry.commands[cmd];
      if (handler) {
        await handler(ctx);
        return;
      }
    }

    // Tenant-specific callbacks
    for (const [prefix, handler] of Object.entries(registry.callbackPrefixes)) {
      if (ctx.interactiveId.startsWith(prefix)) {
        await handler(ctx, ctx.interactiveId);
        return;
      }
    }
  }

  // ── Parse text command ──
  const lower = ctx.text.toLowerCase().trim();
  const firstWord = lower.split(/\s+/)[0];

  // Menu/help
  if (["menu", "help", "yardım", "yardim", "merhaba", "başla", "basla"].includes(firstWord)) {
    await showMenu(ctx, tenant, registry);
    return;
  }

  // Check aliases
  const resolved = registry.aliases[firstWord] || firstWord;

  // Check commands
  const handler = registry.commands[resolved];
  if (handler) {
    await handler(ctx);
    return;
  }

  // Unrecognized
  await sendText(ctx.phone, `Komutu anlamadım. Yardım için "menu" yazın.`);
}

// ── Help menu ────────────────────────────────────────────────────────────

async function showMenu(
  ctx: WaContext,
  tenant: ReturnType<typeof getTenantByKey>,
  _registry: TenantCommandRegistry,
) {
  if (!tenant) {
    await sendText(ctx.phone, "Yardım için yöneticinize başvurun.");
    return;
  }

  let text = `${tenant.icon} *${tenant.name}*\n\nSanal ekibiniz:\n\n`;
  for (const emp of tenant.employees) {
    text += `${emp.icon} *${emp.name}*\n`;
    text += `   ${emp.commands.slice(0, 3).join(", ")}${emp.commands.length > 3 ? "..." : ""}\n\n`;
  }
  text += `💡 Komut adını yazarak kullanabilirsiniz.`;

  await sendButtons(ctx.phone, text, [
    { id: "cmd:brifing", title: "Brifing" },
  ]);
}
