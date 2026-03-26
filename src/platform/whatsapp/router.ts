/**
 * Central Command Router — routes WhatsApp commands to tenant-specific handlers
 */

import type { WaContext, TenantCommandRegistry } from "./types";
import { getSession, endSession } from "./session";
import { sendText, sendButtons, sendList } from "./send";
import { emlakCommands } from "@/tenants/emlak/commands";
import { bayiCommands } from "@/tenants/bayi/commands";
import { muhasebeCommands } from "@/tenants/muhasebe/commands";
import { otelCommands } from "@/tenants/otel/commands";
import { siteyonetimCommands } from "@/tenants/siteyonetim/commands";
import { getTenantByKey } from "@/tenants/config";
import { getServiceClient } from "@/platform/auth/supabase";

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
    // SaaS switch callback (from gateway) — switch tenant + show menu
    if (ctx.interactiveId.startsWith("saas:")) {
      const switchedKey = ctx.interactiveId.replace("saas:", "");
      // Save active session to platform DB
      const supabase = getServiceClient();
      await supabase.from("saas_active_session").upsert({
        phone: ctx.phone,
        active_saas_key: switchedKey,
        updated_at: new Date().toISOString(),
      });
      // Show switched tenant's menu
      const switchedTenant = getTenantByKey(switchedKey);
      const switchedRegistry = REGISTRIES[switchedKey];
      if (switchedTenant && switchedRegistry) {
        await showMenu({ ...ctx, tenantKey: switchedKey }, switchedTenant, switchedRegistry);
      } else {
        await sendText(ctx.phone, `${switchedKey} sistemi henüz aktif değil.`);
      }
      return;
    }

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

    // Employee selection callback
    if (ctx.interactiveId.startsWith("emp:")) {
      const empKey = ctx.interactiveId.replace("emp:", "");
      await showEmployeeCommands(ctx, tenant, empKey);
      return;
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

  // System commands (shared across all tenants)
  if (firstWord === "kilavuz" || firstWord === "kılavuz") {
    await showGuide(ctx, tenant);
    return;
  }
  if (firstWord === "profil") {
    await showProfile(ctx);
    return;
  }
  if (firstWord === "favoriler") {
    await sendButtons(ctx.phone, "⭐ Favori düzenleme yakında aktif olacak.\n\nŞimdilik varsayılan favoriler gösterilmektedir.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
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

// ── Guide command (shared) ───────────────────────────────────────────────

async function showGuide(ctx: WaContext, tenant: ReturnType<typeof getTenantByKey>) {
  if (!tenant) return;

  let text = `📖 *${tenant.name} — Kullanım Kılavuzu*\n\n`;
  text += `Bu sistem WhatsApp üzerinden çalışır. İşte temel bilgiler:\n\n`;
  text += `*1. Menü*\n"menu" yazarak tüm komutlara ulaşabilirsiniz.\n\n`;
  text += `*2. Sanal Elemanlar*\nMenüden bir eleman seçin, komutlarını görün, tıklayın.\n\n`;
  text += `*3. Komut Yazma*\nKomut adını doğrudan yazabilirsiniz. Örnek: brifing\n\n`;
  text += `*4. İptal*\nBir işlem sırasında "iptal" yazarak vazgeçebilirsiniz.\n\n`;
  text += `*5. SaaS Değiştirme*\n"degistir" yazarak farklı bir sisteme geçebilirsiniz.\n\n`;
  text += `*6. Web Panel*\n"webpanel" yazarak tarayıcıdan giriş yapabilirsiniz.\n\n`;

  text += `*Ekibiniz:*\n`;
  for (const emp of tenant.employees) {
    text += `${emp.icon} ${emp.name} — ${emp.description}\n`;
  }

  await sendButtons(ctx.phone, text, [
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}

// ── Help menu — List message with employees ─────────────────────────────

async function showMenu(
  ctx: WaContext,
  tenant: ReturnType<typeof getTenantByKey>,
  _registry: TenantCommandRegistry,
) {
  if (!tenant || !tenant.employees.length) {
    await sendText(ctx.phone, "Yardım için yöneticinize başvurun.");
    return;
  }

  const empRows = tenant.employees.map((emp) => ({
    id: `emp:${emp.key}`,
    title: `${emp.icon} ${emp.name}`.substring(0, 24),
    description: emp.description.substring(0, 72),
  }));

  const systemCommands = [
    { id: "cmd:kilavuz", title: "📖 Kılavuz", description: "Sistemi nasıl kullanırım?" },
    { id: "cmd:webpanel", title: "🖥 Web Panel", description: "Dashboard'a giriş linki" },
    { id: "cmd:profil", title: "👤 Profil Bilgileri", description: "Hesap bilgileriniz" },
  ];

  // WhatsApp List max 10 rows — adjust dynamically
  const totalFixed = empRows.length + systemCommands.length;
  const maxFavorites = Math.max(0, 10 - totalFixed);

  // Default favorites per tenant (first employee's top command + brifing)
  const firstEmpCmd = tenant.employees[0]?.commands[0];
  const allFavorites = [
    { id: "cmd:brifing", title: "📋 Brifing", description: "Günlük özet" },
    ...(firstEmpCmd ? [{ id: `cmd:${firstEmpCmd}`, title: `⭐ ${firstEmpCmd}`, description: tenant.employees[0]?.name || "" }] : []),
  ];
  const favoriteCommands = allFavorites.slice(0, maxFavorites);

  // TODO: load user's custom favorites from DB

  const sections = [];
  if (favoriteCommands.length > 0) {
    sections.push({ title: "Sık Kullanılanlar", rows: favoriteCommands });
  }
  sections.push({ title: "Sanal Elemanlar", rows: empRows });
  sections.push({ title: "Sistem", rows: systemCommands });

  await sendList(ctx.phone,
    `${tenant.icon} *${tenant.name}*\n\nBir eleman, komut veya sistem işlemi seçin.`,
    "Ekibi Çağır",
    sections,
  );
}

// ── Employee commands — show commands for selected employee ──────────────

// ── Profile command (shared) ─────────────────────────────────────────────

async function showProfile(ctx: WaContext) {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, phone, whatsapp_phone, preferred_locale, created_at")
    .eq("id", ctx.userId)
    .single();

  if (!profile) {
    await sendButtons(ctx.phone, "Profil bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const tenant = getTenantByKey(ctx.tenantKey);
  const dateStr = new Date(profile.created_at).toLocaleDateString("tr-TR");

  let text = `👤 *Profil Bilgileri*\n\n`;
  text += `Ad: ${profile.display_name || "-"}\n`;
  text += `E-posta: ${profile.email || "-"}\n`;
  text += `Telefon: ${profile.phone || "-"}\n`;
  text += `WhatsApp: ${profile.whatsapp_phone || "-"}\n`;
  text += `Dil: ${profile.preferred_locale || "tr"}\n`;
  text += `SaaS: ${tenant?.name || "-"}\n`;
  text += `Kayıt: ${dateStr}`;

  await sendButtons(ctx.phone, text, [{ id: "cmd:menu", title: "Ana Menü" }]);
}

// ── Employee commands — show commands for selected employee ──────────────

async function showEmployeeCommands(
  ctx: WaContext,
  tenant: ReturnType<typeof getTenantByKey>,
  employeeKey: string,
) {
  if (!tenant) return;

  const emp = tenant.employees.find(e => e.key === employeeKey);
  if (!emp) {
    await showMenu(ctx, tenant, {} as TenantCommandRegistry);
    return;
  }

  const rows = emp.commands.map((cmd) => ({
    id: `cmd:${cmd}`,
    title: cmd.substring(0, 24),
  }));

  if (rows.length <= 3) {
    await sendButtons(ctx.phone,
      `${emp.icon} *${emp.name}*\n\n${emp.description}\n\nBir komut seçin:`,
      rows.map(r => ({ id: r.id, title: r.title })),
    );
  } else {
    await sendList(ctx.phone,
      `${emp.icon} *${emp.name}*\n\n${emp.description}\n\nBir komut seçin:`,
      "Komutlar",
      [{ title: emp.name, rows }],
    );
  }
}
