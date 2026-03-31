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
import { marketCommands } from "@/tenants/market/commands";
import { getTenantByKey } from "@/tenants/config";
import { getServiceClient } from "@/platform/auth/supabase";
import { COMMAND_LABELS } from "./command-labels";

// ── Registry per tenant ──────────────────────────────────────────────────

const REGISTRIES: Record<string, TenantCommandRegistry> = {
  emlak: emlakCommands,
  bayi: bayiCommands,
  muhasebe: muhasebeCommands,
  otel: otelCommands,
  siteyonetim: siteyonetimCommands,
  market: marketCommands,
};

// ── Main router ──────────────────────────────────────────────────────────

export async function routeCommand(ctx: WaContext): Promise<void> {
  const registry = REGISTRIES[ctx.tenantKey];
  if (!registry) {
    await sendText(ctx.phone, "Bu SaaS için komut sistemi henüz kurulmamış.");
    return;
  }

  let tenant = getTenantByKey(ctx.tenantKey);

  // ── Check for callback FIRST (before session — saas switch must work even during active session) ──
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
      // Platform system commands (shared across all tenants)
      if (cmd === "kilavuz") {
        await showGuide(ctx, tenant);
        return;
      }
      if (cmd === "profil") {
        await showProfile(ctx);
        return;
      }
      if (cmd === "webpanel") {
        await handleWebpanelShared(ctx, tenant);
        return;
      }
      if (cmd === "favoriler") {
        await sendButtons(ctx.phone, "⭐ Favori düzenleme yakında aktif olacak.", [{ id: "cmd:menu", title: "Ana Menü" }]);
        return;
      }
      if (cmd === "hakkimizda") {
        await showAbout(ctx);
        return;
      }
      if (cmd === "uzanti") {
        await showExtensionSetup(ctx);
        return;
      }
      const handler = registry.commands[cmd];
      if (handler) {
        await handler(ctx);
        return;
      }
    }

    // Agent proposal approval/rejection
    if (ctx.interactiveId.startsWith("agent_ok:") || ctx.interactiveId.startsWith("agent_no:")) {
      const approved = ctx.interactiveId.startsWith("agent_ok:");
      const proposalId = ctx.interactiveId.replace(/^agent_(ok|no):/, "");
      // Dynamic import to avoid circular deps
      const { handleAgentApproval } = await import("@/platform/agents/engine");
      // Load tenant agents
      let agents: Record<string, import("@/platform/agents/types").AgentDefinition> = {};
      if (ctx.tenantKey === "emlak") {
        const { emlakAgents } = await import("@/tenants/emlak/agents");
        agents = emlakAgents;
      } else if (ctx.tenantKey === "siteyonetim") {
        const { siteyonetimAgents } = await import("@/tenants/siteyonetim/agents");
        agents = siteyonetimAgents;
      } else if (ctx.tenantKey === "bayi") {
        const { bayiAgents } = await import("@/tenants/bayi/agents");
        agents = bayiAgents;
      }
      await handleAgentApproval(
        { userId: ctx.userId, tenantId: ctx.tenantId, phone: ctx.phone, userName: ctx.userName },
        proposalId, approved, agents
      );
      return;
    }

    // Agent setup callbacks
    if (ctx.interactiveId.startsWith("asetup:")) {
      const { handleAgentSetupInput } = await import("@/platform/agents/setup");
      await handleAgentSetupInput(ctx);
      return;
    }

    // Employee selection callback — check agent config first
    if (ctx.interactiveId.startsWith("emp:")) {
      const empKey = ctx.interactiveId.replace("emp:", "");
      // Check if this employee's agent needs setup
      if (ctx.tenantKey === "emlak" || ctx.tenantKey === "siteyonetim" || ctx.tenantKey === "bayi") {
        try {
          const { isAgentConfigured, startAgentSetup } = await import("@/platform/agents/setup");
          // siteyonetim/bayi agent keys are prefixed with "sy_"/"bayi_" to avoid global SETUP_FLOWS collision
          const agentKey = ctx.tenantKey === "siteyonetim" ? `sy_${empKey}` : ctx.tenantKey === "bayi" ? `bayi_${empKey}` : empKey;
          const configured = await isAgentConfigured(ctx.userId, agentKey);
          if (!configured) {
            const { getAgentSetup } = await import("@/platform/agents/setup");
            const setup = getAgentSetup(agentKey);
            if (setup) {
              await startAgentSetup(ctx, agentKey);
              return;
            }
          }
        } catch { /* setup not available — show commands normally */ }
      }
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

  // ── Check for active session (multi-step command) ──
  const session = await getSession(ctx.userId);
  if (session) {
    const lower = ctx.text.toLowerCase().trim();
    if (lower === "iptal" || lower === "vazgeç" || lower === "vazgec") {
      await endSession(ctx.userId);
      await sendButtons(ctx.phone, "❌ İşlem iptal edildi.", [
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }
    // Agent setup sessions
    if (session.command.startsWith("agent_setup_")) {
      const { handleAgentSetupInput } = await import("@/platform/agents/setup");
      await handleAgentSetupInput(ctx);
      return;
    }
    const stepHandler = registry.stepHandlers[session.command];
    if (stepHandler) {
      await stepHandler(ctx, session);
      return;
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
  if (firstWord === "hakkimizda" || firstWord === "hakkımızda") {
    await showAbout(ctx);
    return;
  }
  if (firstWord === "uzanti" || firstWord === "uzantı" || firstWord === "extension") {
    await showExtensionSetup(ctx);
    return;
  }
  if (firstWord === "webpanel" || firstWord === "panel" || firstWord === "dashboard") {
    await handleWebpanelShared(ctx, tenant);
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

  // ── AI intent detection (before giving up) ──
  try {
    const { detectIntent } = await import("@/platform/ai/claude");
    const intent = await detectIntent(ctx.text);
    if (intent && intent.confidence >= 0.75 && intent.command) {
      // Reconstruct text with args for the handler
      if (intent.args) {
        ctx.text = `${intent.command} ${intent.args}`;
      }
      const aiHandler = registry.commands[intent.command];
      if (aiHandler) {
        await aiHandler(ctx);
        return;
      }
    }
  } catch { /* AI unavailable — fall through to unrecognized */ }

  // Unrecognized
  await sendButtons(ctx.phone, "Komutu anlamadım.", [
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}

// ── Web panel command (shared — uses tenant subdomain) ───────────────────

async function handleWebpanelShared(ctx: WaContext, tenant: ReturnType<typeof getTenantByKey>) {
  const subdomain = tenant?.slug || "estateai";
  const appUrl = `https://${subdomain}.upudev.nl`;

  try {
    const supabase = getServiceClient();
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase.from("magic_link_tokens").insert({
      user_id: ctx.userId,
      token,
      expires_at: expiresAt,
    });

    const magicUrl = `${appUrl}/auth/magic?token=${token}`;
    await sendButtons(ctx.phone,
      `🖥 Web Panel\n\nAşağıdaki linke tıklayarak giriş yapın:\n\n${magicUrl}\n\n⏱ 15 dakika geçerli.`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
  } catch {
    await sendButtons(ctx.phone,
      `🖥 Web Panel\n\n${appUrl}/tr/login`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
  }
}

// ── Guide command (generic — same structure for all SaaS) ────────────────

async function showGuide(ctx: WaContext, tenant: ReturnType<typeof getTenantByKey>) {
  if (!tenant) return;

  let text = `📖 *${tenant.name} — Kullanım Kılavuzu*\n\n`;
  text += `Bu sistem WhatsApp üzerinden çalışan AI destekli bir sanal eleman platformudur.\n\n`;
  text += `*Nasıl Kullanılır:*\n\n`;
  text += `1️⃣ *Menüyü açın*\n"menu" yazın veya aşağıdaki Ana Menü butonuna tıklayın.\n\n`;
  text += `2️⃣ *Ekip üyenizi seçin*\nMenüden "Ekibi Çağır" butonuna tıklayın. Sanal elemanlarınız listelenecek.\n\n`;
  text += `3️⃣ *Komutları görün*\nBir eleman seçtiğinizde, o elemanın yapabileceği işlemler görünür.\n\n`;
  text += `4️⃣ *Komutu seçin*\nUygun komutu tıklayın — sistem sizi adım adım yönlendirecek.\n\n`;
  text += `*Diğer bilgiler:*\n`;
  text += `• İşlem sırasında "iptal" yazarak vazgeçebilirsiniz\n`;
  text += `• "webpanel" ile tarayıcıdan giriş yapabilirsiniz`;

  await sendButtons(ctx.phone, text, [
    { id: "cmd:menu", title: "Ana Menü" },
  ]);
}

// ── About command (shared) ───────────────────────────────────────────────

async function showAbout(ctx: WaContext) {
  const text = `ℹ️ *Hakkımızda*\n\n` +
    `Bu platform UPU Dev tarafından geliştirilmiştir.\n\n` +
    `UPU Dev, işletmelere AI destekli sanal eleman çözümleri sunan bir teknoloji şirketidir. ` +
    `Her sektör için özelleştirilmiş sanal çalışan ekipleri oluşturuyoruz — emlak, bayi yönetimi, muhasebe, otel ve site yönetimi.\n\n` +
    `Sanal elemanlarımız WhatsApp üzerinden 7/24 çalışır, komutlarınızı anlar ve işlerinizi kolaylaştırır.\n\n` +
    `🌐 Daha fazla bilgi: upudev.nl`;

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

  // Message 1: Favorites as buttons (always shown, max 3)
  const favCmds = tenant.defaultFavorites || [];
  if (favCmds.length > 0) {
    const favButtons = favCmds.slice(0, 3).map(cmd => ({
      id: `cmd:${cmd}`,
      title: cmd.substring(0, 20),
    }));
    await sendButtons(ctx.phone,
      `${tenant.icon} *${tenant.name}*\n\n⭐ Sık kullanılanlar:\n\n_("menu" yazarak buraya dönebilirsiniz.)_`,
      favButtons,
    );
  }

  // Message 2: List with employees (max 10 rows)
  const empRows = tenant.employees.map((emp) => ({
    id: `emp:${emp.key}`,
    title: `${emp.icon} ${emp.name}`.substring(0, 24),
    description: emp.description.substring(0, 72),
  })).slice(0, 10);

  await sendList(ctx.phone,
    "Bir sanal eleman seçin:",
    "Ekibi Çağır",
    [
      { title: "Sanal Elemanlar", rows: empRows },
    ],
  );

  // Message 3: System commands as buttons (always shown, max 3)
  await sendButtons(ctx.phone,
    "⚙️ Sistem:",
    [
      { id: "cmd:kilavuz", title: "📖 Kılavuz" },
      { id: "cmd:webpanel", title: "🖥 Web Panel" },
      { id: "cmd:uzanti", title: "🧩 Uzantı Kurulumu" },
    ],
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
    title: (COMMAND_LABELS[cmd] || cmd).substring(0, 24),
    description: COMMAND_LABELS[cmd] ? cmd : "",
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
  // Navigation: back to employee list + main menu
  await sendButtons(ctx.phone, "Veya:", [
    { id: "cmd:menu", title: "👥 Ekibi Çağır" },
  ]);
}

// ── Extension setup command (Emlak only) ────────────────────────────────

async function showExtensionSetup(ctx: WaContext) {
  const supabase = getServiceClient();

  // Generate or get token
  const { randomBytes } = await import("crypto");
  let code: string;

  const { data: existing } = await supabase
    .from("extension_tokens")
    .select("token")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (existing) {
    code = existing.token.substring(0, 6).toUpperCase();
  } else {
    const fullToken = randomBytes(24).toString("hex");
    code = fullToken.substring(0, 6).toUpperCase();
    await supabase.from("extension_tokens").insert({
      user_id: ctx.userId,
      token: fullToken,
    });
  }

  let text = `🧩 *Chrome Uzantı Kurulumu*\n\n`;
  text += `Sahibinden'e ilan yayınlamak için Chrome uzantımızı kullanın. `;
  text += `Uzantı, mülk bilgilerinizi otomatik olarak forma doldurur.\n\n`;
  text += `*Kurulum:*\n`;
  text += `1. Uzantıyı kurun:\nhttps://chromewebstore.google.com/detail/bcafoeijofbhelbanpfjhmhiokjnggbe\n\n`;
  text += `2. Uzantıyı açın, bağlantı kodunuzu girin:\n*${code}*\n\n`;
  text += `3. sahibinden.com/ilan-ver açın → mülk seçin → Formu Doldur\n\n`;
  text += `_Kurulum tek seferlik — bir kez bağlandıktan sonra her zaman kullanabilirsiniz._`;

  await sendButtons(ctx.phone, text, [
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}
