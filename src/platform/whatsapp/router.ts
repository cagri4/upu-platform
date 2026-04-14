/**
 * Central Command Router — routes WhatsApp commands to tenant-specific handlers
 */

import type { WaContext, TenantCommandRegistry } from "./types";
import { getSession, endSession, startSession, updateSession } from "./session";
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
import { isAdmin, routeAdminCommand, routeAdminCallback } from "@/platform/admin/commands";
import { logCommand } from "@/platform/analytics/logger";

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

    // Degistir callbacks — SaaS switch + role switch
    if (ctx.interactiveId.startsWith("degistir_saas:")) {
      const switchedKey = ctx.interactiveId.replace("degistir_saas:", "");
      const supabase = getServiceClient();
      await supabase.from("saas_active_session").upsert({
        phone: ctx.phone, active_saas_key: switchedKey, view_as_role: null,
        updated_at: new Date().toISOString(),
      });
      const switchedTenant = getTenantByKey(switchedKey);
      const switchedRegistry = REGISTRIES[switchedKey];
      if (switchedTenant && switchedRegistry) {
        await sendText(ctx.phone, `✅ *${switchedTenant.name}* sistemine geçildi.`);
        await showMenu({ ...ctx, tenantKey: switchedKey, role: ctx.role }, switchedTenant, switchedRegistry);
      }
      return;
    }
    if (ctx.interactiveId === "degistir_role:no_employee") {
      await sendButtons(ctx.phone, "⚠️ Henüz çalışan atanmadı. Önce çalışan ekleyin.", [
        { id: "cmd:calisanekle", title: "➕ Çalışan Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }
    if (ctx.interactiveId.startsWith("degistir_role:")) {
      const newRole = ctx.interactiveId.replace("degistir_role:", "");
      const supabase = getServiceClient();
      await supabase.from("saas_active_session").upsert({
        phone: ctx.phone, active_saas_key: ctx.tenantKey,
        view_as_role: newRole === "reset" ? null : newRole,
        updated_at: new Date().toISOString(),
      });
      if (newRole === "reset") {
        await sendText(ctx.phone, `✅ Kendi görünümünüze döndünüz.`);
      } else {
        const roleLabels: Record<string, string> = { dealer: "Bayi", employee: "Çalışan", admin: "Admin" };
        await sendText(ctx.phone, `✅ ${roleLabels[newRole] || newRole} görünümüne geçildi.`);
      }
      // Refresh menu with new role view
      const viewRole = newRole === "reset" ? ctx.role : newRole as WaContext["role"];
      if (tenant) {
        const reg = REGISTRIES[ctx.tenantKey];
        if (reg) await showMenu({ ...ctx, role: viewRole }, tenant, reg);
      }
      return;
    }

    // Admin panel callbacks
    if (ctx.interactiveId.startsWith("admin:")) {
      const adminUser = await isAdmin(ctx);
      if (adminUser) {
        const handled = await routeAdminCallback(ctx, ctx.interactiveId);
        if (handled) {
          logCommand(ctx, ctx.interactiveId, true);
          return;
        }
      }
    }

    // Test state confirmation callback (sifirla)
    if (ctx.interactiveId.startsWith("sifirla:")) {
      const { handleSifirlaCallback } = await import("./test-state");
      await handleSifirlaCallback(ctx, ctx.interactiveId);
      logCommand(ctx, ctx.interactiveId, true);
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
      if (cmd === "profil" || cmd === "profilim") {
        await showProfile(ctx);
        return;
      }
      if (cmd === "webpanel") {
        await handleWebpanelShared(ctx, tenant);
        return;
      }
      if (cmd === "favoriler") {
        await showFavorites(ctx, tenant, registry);
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
      if (cmd === "degistir") {
        await handleDegistir(ctx);
        return;
      }
      // These are registry commands triggered from system menu
      if (cmd === "calisanekle" || cmd === "bayidavet" || cmd === "calisanyonet") {
        const reg = REGISTRIES[ctx.tenantKey];
        const h = reg?.commands[cmd];
        if (h) {
          // Auto-save (admin dev workflow) before running state-changing command
          if (await isAdmin(ctx)) {
            const { autoSaveSnapshotSilent } = await import("./test-state");
            await autoSaveSnapshotSilent(ctx.userId, ctx.tenantKey);
          }
          await h(ctx);
          return;
        }
      }
      const handler = registry.commands[cmd];
      if (handler) {
        // Auto-save before state-changing command (admin only, dev workflow)
        if (await isAdmin(ctx)) {
          const { autoSaveSnapshotSilent } = await import("./test-state");
          await autoSaveSnapshotSilent(ctx.userId, ctx.tenantKey);
        }
        const start = Date.now();
        // Commands that handle their own trigger (callback/multi-step flows).
        // Router must NOT trigger these — they fire from success handlers.
        const SELF_TRIGGERING_COMMANDS = new Set([
          "fiyatbelirle", "fiyatsor", "paylas", "musteriEkle", "eslestir",
          "hatirlatma", "sunum", "takipEt", "satistavsiye", "mulkoner",
          "fotograf", "mulkekle",
        ]);
        try {
          await handler(ctx);
          logCommand(ctx, cmd, true, Date.now() - start);
          if (!SELF_TRIGGERING_COMMANDS.has(cmd)) {
            const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
            await triggerMissionCheck(ctx.userId, ctx.tenantKey, cmd, ctx.phone).catch(() => {});
          }
        } catch (err) {
          logCommand(ctx, cmd, false, Date.now() - start, err instanceof Error ? err.message : String(err));
          throw err;
        }
        return;
      }
    }

    // Profile edit callbacks
    if (ctx.interactiveId.startsWith("profil_edit:")) {
      await handleProfileEditCallback(ctx);
      return;
    }

    // Favorites add/remove callbacks
    if (ctx.interactiveId.startsWith("fav_add:") || ctx.interactiveId.startsWith("fav_rm:")) {
      await handleFavCallback(ctx);
      return;
    }

    // Agent draft send/edit/reject
    if (ctx.interactiveId.startsWith("agent_send:")) {
      const proposalId = ctx.interactiveId.replace("agent_send:", "");
      await handleAgentDraftSend(ctx, proposalId);
      return;
    }
    if (ctx.interactiveId.startsWith("agent_edit:")) {
      const proposalId = ctx.interactiveId.replace("agent_edit:", "");
      await handleAgentDraftEdit(ctx, proposalId);
      return;
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
      } else if (ctx.tenantKey === "otel") {
        const { otelAgents } = await import("@/tenants/otel/agents");
        agents = otelAgents;
      } else if (ctx.tenantKey === "muhasebe") {
        const { muhasebeAgents } = await import("@/tenants/muhasebe/agents");
        agents = muhasebeAgents;
      } else if (ctx.tenantKey === "market") {
        const { marketAgents } = await import("@/tenants/market/agents");
        agents = marketAgents;
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
      if (ctx.tenantKey === "emlak" || ctx.tenantKey === "siteyonetim" || ctx.tenantKey === "bayi" || ctx.tenantKey === "otel" || ctx.tenantKey === "muhasebe" || ctx.tenantKey === "market") {
        try {
          const { isAgentConfigured, startAgentSetup } = await import("@/platform/agents/setup");
          // siteyonetim/bayi/otel agent keys are prefixed to avoid global SETUP_FLOWS collision
          const agentKey = ctx.tenantKey === "siteyonetim" ? `sy_${empKey}` : ctx.tenantKey === "bayi" ? `bayi_${empKey}` : ctx.tenantKey === "otel" ? `otel_${empKey}` : ctx.tenantKey === "muhasebe" ? `muh_${empKey}` : ctx.tenantKey === "market" ? `mkt_${empKey}` : empKey;
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
    if (lower === "menu" || lower === "menü" || lower === "ana menü" || lower === "ana menu") {
      await endSession(ctx.userId);
      // Fall through to menu handling below
    } else if (lower === "sifirla" || lower === "sıfırla" || lower === "yukle" || lower === "yükle" || lower === "kaydet") {
      // Test state commands must bypass active sessions — otherwise the
      // admin can't escape a mid-flow step to rollback. End the session
      // and fall through to the normal routing which dispatches them.
      await endSession(ctx.userId);
      // fall through
    } else {
      // Profile edit sessions
      if (session.command === "profil_edit") {
        await handleProfileEditInput(ctx, session);
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
  }

  // ── Parse text command ──
  const lower = ctx.text.toLowerCase().trim();
  const firstWord = lower.split(/\s+/)[0];

  // Admin text commands (prefix "a ")
  if (lower.startsWith("a ")) {
    const adminUser = await isAdmin(ctx);
    if (adminUser) {
      const adminInput = lower.substring(2).trim();
      const handled = await routeAdminCommand(ctx, adminInput);
      if (handled) {
        logCommand(ctx, `admin:${adminInput}`, true);
        return;
      }
    }
  }

  // Test state commands (admin-only, defined in test-state.ts)
  // /kaydet, /yukle, /sifirla — dev workflow accelerators
  {
    const { isTestStateCommand, routeTestStateCommand } = await import("./test-state");
    if (isTestStateCommand(firstWord)) {
      await routeTestStateCommand(ctx, firstWord);
      logCommand(ctx, `test-state:${firstWord}`, true);
      return;
    }
  }

  // Menu/help
  if (["menu", "help", "yardım", "yardim", "merhaba", "başla", "basla"].includes(firstWord)) {
    await showMenu(ctx, tenant, registry);
    return;
  }

  // System commands (shared across all tenants)
  if (firstWord === "ekibim" || firstWord === "ekip" || firstWord === "kariyer") {
    const { handleEkibim } = await import("./ekibim");
    await handleEkibim(ctx);
    return;
  }
  if (firstWord === "leaderboard" || firstWord === "siralama" || firstWord === "sıralama") {
    const { handleLeaderboard } = await import("./leaderboard");
    await handleLeaderboard(ctx);
    return;
  }
  if (firstWord === "kilavuz" || firstWord === "kılavuz") {
    await showGuide(ctx, tenant);
    return;
  }
  if (firstWord === "profil" || firstWord === "profilim") {
    await showProfile(ctx);
    return;
  }
  if (firstWord === "favoriler") {
    await showFavorites(ctx, tenant, registry);
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
  if (firstWord === "degistir" || firstWord === "değiştir" || firstWord === "switch") {
    await handleDegistir(ctx);
    return;
  }

  // Check aliases
  const resolved = registry.aliases[firstWord] || firstWord;

  // Check commands
  const handler = registry.commands[resolved];
  if (handler) {
    // Auto-save before state-changing command (admin only, dev workflow)
    if (await isAdmin(ctx)) {
      const { autoSaveSnapshotSilent } = await import("./test-state");
      await autoSaveSnapshotSilent(ctx.userId, ctx.tenantKey);
    }
    const start = Date.now();
    const SELF_TRIGGERING = new Set([
      "fiyatbelirle", "fiyatsor", "paylas", "musteriEkle", "eslestir",
      "hatirlatma", "sunum", "takipEt", "satistavsiye", "mulkoner",
      "fotograf", "mulkekle",
    ]);
    try {
      await handler(ctx);
      logCommand(ctx, resolved, true, Date.now() - start);
      if (!SELF_TRIGGERING.has(resolved)) {
        const { triggerMissionCheck } = await import("@/platform/gamification/triggers");
        await triggerMissionCheck(ctx.userId, ctx.tenantKey, resolved, ctx.phone).catch(() => {});
      }
    } catch (err) {
      logCommand(ctx, resolved, false, Date.now() - start, err instanceof Error ? err.message : String(err));
      throw err;
    }
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
  } catch { /* AI unavailable — fall through */ }

  // ── Free text → active agent task routing ──
  try {
    const { getActiveTask: getActive } = await import("@/platform/agents/memory");
    // Check all possible agent keys for active tasks
    const supabase = getServiceClient();
    const { data: activeTasks } = await supabase
      .from("agent_tasks")
      .select("id, agent_key, status")
      .eq("user_id", ctx.userId)
      .eq("status", "waiting_human")
      .limit(1);

    if (activeTasks?.length) {
      const task = activeTasks[0];
      const { saveMessage } = await import("@/platform/agents/memory");
      await saveMessage(ctx.userId, ctx.tenantId, task.agent_key, task.id, "user", ctx.text);

      // Check if this is a draft edit response
      const { data: editSession } = await supabase
        .from("command_sessions")
        .select("data")
        .eq("user_id", ctx.userId)
        .eq("command", "agent_draft_edit")
        .maybeSingle();

      if (editSession?.data) {
        const proposalId = (editSession.data as Record<string, unknown>).proposal_id as string;
        await endSession(ctx.userId);
        await finalizeDraftEdit(ctx, proposalId, ctx.text);
        return;
      }
    }
  } catch { /* ignore */ }

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

  // HUD: resolve active mission + its resume CTA (Quest Director pattern).
  // Instead of a passive footer we render it as an actionable row at the
  // top of the favorites list — single tap to resume the mission.
  const { getActiveMission } = await import("@/platform/gamification/engine");
  const { MISSION_CTA } = await import("@/platform/gamification/triggers");
  const activeMission = await getActiveMission(ctx.userId, ctx.tenantKey);
  const activeCta = activeMission ? MISSION_CTA[activeMission.mission_key] : null;

  // Message 1: Favorites as list (user's or default, up to 10)
  const userFavs = await getUserFavorites(ctx.userId);
  const favCmds = userFavs.length > 0 ? userFavs : (tenant.defaultFavorites || []);

  const favRows = favCmds.slice(0, 10).map(cmd => ({
    id: `cmd:${cmd}`,
    title: (COMMAND_LABELS[cmd] || cmd).substring(0, 24),
    description: "",
  }));

  // ── Corridor lock: active mission = ONLY show mission CTA ──────────
  // When user has an active mission, menu shows ONLY the mission button.
  // No favorites, no employees, no distractions. Pure corridor.
  // Full menu unlocks when all missions are done (endgame) or no active mission.
  if (activeMission && activeCta) {
    await sendButtons(ctx.phone,
      `🎯 *Aktif Görev*\n${activeMission.emoji} ${activeMission.title}\n_${activeCta.hint}_`,
      [activeCta.button],
    );
    return; // Corridor: nothing else shown
  }

  // ── Full menu (no active mission — endgame or between chapters) ────
  if (favRows.length > 0) {
    await sendList(ctx.phone,
      `${tenant.icon} *${tenant.name}*\n\n⭐ Favorilerim:\n\n_("menu" yazarak buraya dönebilirsiniz.)_`,
      "Favoriler",
      [{ title: "Favorilerim", rows: favRows.slice(0, 10) }],
    );
  }

  let visibleEmployees = tenant.employees;

  if (ctx.role === "dealer") {
    const dealerEmpKeys = tenant.dealerEmployees || [];
    if (dealerEmpKeys.length > 0) {
      visibleEmployees = tenant.employees.filter(e => dealerEmpKeys.includes(e.key));
    } else {
      visibleEmployees = [];
    }
  } else if (ctx.role === "employee") {
    const permittedEmps = (ctx.permissions?.employees as string[]) || [];
    if (permittedEmps.length > 0) {
      visibleEmployees = tenant.employees.filter(e => permittedEmps.includes(e.key));
    }
  }

  const empRows = visibleEmployees.map((emp) => ({
    id: `emp:${emp.key}`,
    title: `${emp.icon} ${emp.name}`.substring(0, 24),
    description: emp.description.substring(0, 72),
  })).slice(0, 10);

  if (empRows.length > 0) {
    await sendList(ctx.phone,
      "Bir sanal eleman seçin:",
      "Ekibi Çağır",
      [
        { title: "Sanal Elemanlar", rows: empRows },
      ],
    );
  }

  // Message 3: System commands (filtered by role + tenant)
  const systemRows = [
    { id: "cmd:profilim", title: "👤 Profilim", description: "Profil bilgileri ve düzenleme" },
  ];

  // Favorites — not for dealers (too few commands)
  if (ctx.role !== "dealer") {
    systemRows.push({ id: "cmd:favoriler", title: "⭐ Favoriler", description: "Favori komutları düzenle" });
  }

  systemRows.push({ id: "cmd:kilavuz", title: "📖 Kılavuz", description: "Kullanım rehberi" });
  systemRows.push({ id: "cmd:webpanel", title: "🖥 Web Panel", description: "Tarayıcıdan giriş yap" });

  // Uzantı — only for emlak tenant admin
  if (ctx.tenantKey === "emlak" && ctx.role !== "dealer") {
    systemRows.push({ id: "cmd:uzanti", title: "🧩 Uzantı Kurulumu", description: "Chrome uzantısı bağlantısı" });
  }

  // Degistir — only for actual admins (or when view_as_role is active)
  {
    const supabaseCheck = getServiceClient();
    const { data: actualProfile } = await supabaseCheck
      .from("profiles")
      .select("role")
      .eq("id", ctx.userId)
      .single();
    const { data: viewSession } = await supabaseCheck
      .from("saas_active_session")
      .select("view_as_role")
      .eq("phone", ctx.phone)
      .maybeSingle();

    const isActualAdmin = actualProfile?.role === "admin" || actualProfile?.role === "user";
    const hasViewMode = !!viewSession?.view_as_role;

    // Admin shortcuts for bayi tenant
    if (isActualAdmin && ctx.tenantKey === "bayi" && !hasViewMode) {
      systemRows.push({ id: "cmd:calisanekle", title: "👥 Çalışan Ekle", description: "Yeni çalışan ekle ve yetki ver" });
      systemRows.push({ id: "cmd:bayidavet", title: "🏪 Bayi Davet Linki", description: "Bayiler için davet linki oluştur" });
    }

    if (isActualAdmin || hasViewMode) {
      systemRows.push({ id: "cmd:degistir", title: "🔄 Değiştir", description: "SaaS veya görünüm değiştir" });
    }
  }

  systemRows.push({ id: "cmd:hakkimizda", title: "ℹ️ Hakkımızda", description: "UPU Dev hakkında bilgi" });

  // Add admin panel button if user is admin
  const adminUser = await isAdmin(ctx);
  if (adminUser) {
    systemRows.push({ id: "admin:panel", title: "📊 Admin Panel", description: "Platform yönetim paneli" });
  }

  await sendList(ctx.phone,
    "⚙️ Sistem:",
    "Sistem Menüsü",
    [{ title: "Sistem", rows: systemRows }],
  );
}

// ── Employee commands — show commands for selected employee ──────────────

// ── Profile command (shared) ─────────────────────────────────────────────

async function showProfile(ctx: WaContext) {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, phone, whatsapp_phone, preferred_locale, created_at, metadata")
    .eq("id", ctx.userId)
    .single();

  if (!profile) {
    await sendButtons(ctx.phone, "Profil bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const tenant = getTenantByKey(ctx.tenantKey);
  const dateStr = new Date(profile.created_at).toLocaleDateString("tr-TR");
  const meta = (profile.metadata || {}) as Record<string, unknown>;

  let text = `👤 *Profilim*\n\n`;
  text += `*Ad:* ${profile.display_name || "-"}\n`;
  text += `*Telefon:* ${profile.phone || "-"}\n`;
  text += `*WhatsApp:* ${profile.whatsapp_phone || "-"}\n`;
  text += `*E-posta:* ${profile.email || "-"}\n`;
  text += `*SaaS:* ${tenant?.name || "-"}\n`;
  text += `*Kayıt:* ${dateStr}\n`;

  // Business info from onboarding
  if (meta.office_name || meta.location) {
    text += `\n🏢 *İş Bilgileri*\n`;
    if (meta.office_name) text += `*Ofis:* ${meta.office_name}\n`;
    if (meta.location) text += `*Bölge:* ${meta.location}\n`;
    text += `*Brifing:* ${meta.briefing_enabled ? "Aktif ✅" : "Pasif ❌"}`;
  }

  await sendList(ctx.phone, text, "Düzenle", [
    {
      title: "Profil Düzenle",
      rows: [
        { id: "profil_edit:name", title: "✏️ İsim Değiştir", description: "Görünen adınızı değiştirin" },
        { id: "profil_edit:phone", title: "📱 Telefon Değiştir", description: "Telefon numaranızı güncelleyin" },
        { id: "profil_edit:business", title: "🏢 İş Bilgileri Düzenle", description: "Ofis, bölge ve brifing ayarları" },
        { id: "cmd:menu", title: "📋 Ana Menü", description: "Ana menüye dön" },
      ],
    },
  ]);
}

// ── Profile edit callbacks & session handler ────────────────────────────

async function handleProfileEditCallback(ctx: WaContext) {
  const field = ctx.interactiveId.replace("profil_edit:", "");

  if (field === "name") {
    await startSession(ctx.userId, ctx.tenantId, "profil_edit", "name");
    await sendText(ctx.phone, "✏️ Yeni adınızı yazın:");
  } else if (field === "phone") {
    await startSession(ctx.userId, ctx.tenantId, "profil_edit", "phone");
    await sendText(ctx.phone, "📱 Yeni telefon numaranızı yazın (ör. 05xx xxx xx xx):");
  } else if (field === "business") {
    // Re-run onboarding flow to update business info
    const { initOnboarding, getOnboardingState: getOnbState, sendOnboardingStep } = await import("@/platform/whatsapp/onboarding");
    await initOnboarding(ctx.userId, ctx.tenantId, ctx.tenantKey);
    const state = await getOnbState(ctx.userId);
    if (state) {
      await sendText(ctx.phone, "🏢 İş bilgilerinizi güncelleyelim:");
      await sendOnboardingStep(ctx, state);
    } else {
      await sendButtons(ctx.phone, "Bu SaaS için iş bilgileri düzenleme henüz desteklenmiyor.", [
        { id: "cmd:profilim", title: "👤 Profilim" },
      ]);
    }
  }
}

async function handleProfileEditInput(ctx: WaContext, session: { current_step: string }) {
  const supabase = getServiceClient();
  const value = ctx.text.trim();

  if (!value) {
    await sendText(ctx.phone, "Boş değer gönderilemez. Tekrar deneyin veya \"iptal\" yazın.");
    return;
  }

  if (session.current_step === "name") {
    if (value.length < 2) {
      await sendText(ctx.phone, "İsim en az 2 karakter olmalı. Tekrar deneyin:");
      return;
    }
    await supabase.from("profiles")
      .update({ display_name: value, updated_at: new Date().toISOString() })
      .eq("id", ctx.userId);
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, `✅ İsminiz güncellendi: *${value}*`, [
      { id: "cmd:profilim", title: "👤 Profilim" },
      { id: "cmd:menu", title: "📋 Ana Menü" },
    ]);
  } else if (session.current_step === "phone") {
    const cleaned = value.replace(/[\s\-\(\)]/g, "");
    if (cleaned.length < 10) {
      await sendText(ctx.phone, "Geçerli bir telefon numarası girin (en az 10 hane). Tekrar deneyin:");
      return;
    }
    await supabase.from("profiles")
      .update({ phone: cleaned, updated_at: new Date().toISOString() })
      .eq("id", ctx.userId);
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, `✅ Telefonunuz güncellendi: *${cleaned}*`, [
      { id: "cmd:profilim", title: "👤 Profilim" },
      { id: "cmd:menu", title: "📋 Ana Menü" },
    ]);
  }
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
  text += `3. sahibinden.com/ilan-ver açın → uzantıya tıklayarak mülk seçin. Sayfa, daha önce doldurduğunuz bilgilerle çok kısa bir sürede dolacaktır. Fotoğrafları, adresi ve varsa eksik kısımları doldurup ilanınızı yayınlayabilirsiniz.\n\n`;
  text += `_Kurulum tek seferlik — bir kez bağlandıktan sonra her zaman kullanabilirsiniz._`;

  await sendButtons(ctx.phone, text, [
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}

// ── Favorites helpers ───────────────────────────────────────────────────

async function getUserFavorites(userId: string): Promise<string[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("user_favorites")
    .select("command_keys")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.command_keys && Array.isArray(data.command_keys)) {
    return data.command_keys as string[];
  }
  return [];
}

async function showFavorites(
  ctx: WaContext,
  tenant: ReturnType<typeof getTenantByKey>,
  registry: TenantCommandRegistry,
) {
  if (!tenant) return;

  const userFavs = await getUserFavorites(ctx.userId);
  const favCmds = userFavs.length > 0 ? userFavs : (tenant.defaultFavorites || []);

  // Build current favorites display
  let text = "⭐ *Favorileriniz*\n\n";
  if (favCmds.length === 0) {
    text += "Henüz favori eklenmemiş.\n";
  } else {
    for (const cmd of favCmds) {
      text += `• ${COMMAND_LABELS[cmd] || cmd}\n`;
    }
  }
  text += "\nFavori eklemek veya çıkarmak için aşağıdan seçin:";

  // Get all available commands for this tenant
  const allCmds = Object.keys(registry.commands);
  const notInFav = allCmds.filter(c => !favCmds.includes(c) && COMMAND_LABELS[c]);

  // Show add options as list
  const rows: Array<{ id: string; title: string; description?: string }> = [];

  // Remove options (current favorites)
  for (const cmd of favCmds) {
    rows.push({
      id: `fav_rm:${cmd}`,
      title: `❌ ${(COMMAND_LABELS[cmd] || cmd).substring(0, 20)}`,
      description: "Favorilerden çıkar",
    });
  }

  // Add options (fill remaining space up to 10 rows)
  for (const cmd of notInFav.slice(0, 10 - rows.length)) {
    rows.push({
      id: `fav_add:${cmd}`,
      title: `➕ ${(COMMAND_LABELS[cmd] || cmd).substring(0, 20)}`,
      description: "Favorilere ekle",
    });
  }

  if (rows.length > 0) {
    await sendList(ctx.phone, text, "Düzenle", [
      { title: "Favoriler", rows },
    ]);
  } else {
    await sendButtons(ctx.phone, text, [
      { id: "cmd:menu", title: "📋 Ana Menü" },
    ]);
  }
}

async function handleFavCallback(ctx: WaContext) {
  const supabase = getServiceClient();
  const isAdd = ctx.interactiveId.startsWith("fav_add:");
  const cmd = ctx.interactiveId.replace(/^fav_(add|rm):/, "");

  // Get current favorites
  const { data: existing } = await supabase
    .from("user_favorites")
    .select("command_keys")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  let favs: string[] = (existing?.command_keys as string[]) || [];

  if (isAdd) {
    if (!favs.includes(cmd)) favs.push(cmd);
    if (favs.length > 10) favs = favs.slice(-10); // max 10 (WhatsApp list limit)
  } else {
    favs = favs.filter(f => f !== cmd);
  }

  // Upsert
  await supabase.from("user_favorites").upsert({
    user_id: ctx.userId,
    tenant_id: ctx.tenantId,
    command_keys: favs,
    updated_at: new Date().toISOString(),
  });

  const label = COMMAND_LABELS[cmd] || cmd;
  const msg = isAdd
    ? `⭐ *${label}* favorilere eklendi.`
    : `❌ *${label}* favorilerden çıkarıldı.`;

  await sendButtons(ctx.phone, msg, [
    { id: "cmd:favoriler", title: "⭐ Favoriler" },
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}

// ── Agent Draft Message UI ──────────────────────────────────────────────

async function handleAgentDraftSend(ctx: WaContext, proposalId: string) {
  const supabase = getServiceClient();

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("status", "pending")
    .single();

  if (!proposal) {
    await sendText(ctx.phone, "Bu taslak artık geçerli değil.");
    return;
  }

  const actionData = proposal.action_data as Record<string, unknown>;
  const phone = actionData.phone as string;
  const message = actionData.message as string;

  if (!phone || !message) {
    await sendText(ctx.phone, "Mesaj bilgisi eksik.");
    return;
  }

  // Send the actual message
  await sendText(phone, message);

  // Update proposal
  await supabase.from("agent_proposals")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", proposalId);

  // Log to agent_messages
  const { saveMessage: savMsg } = await import("@/platform/agents/memory");
  await savMsg(ctx.userId, ctx.tenantId, proposal.agent_key, null, "assistant", `Mesaj gönderildi: ${phone}`);

  // Resume task if linked
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("id, current_step")
    .eq("pending_proposal_id", proposalId)
    .eq("status", "waiting_human")
    .maybeSingle();

  if (task) {
    const { updateTaskStatus: updTask, logStep: logS } = await import("@/platform/agents/memory");
    await logS(task.id, task.current_step, "draft_sent", `Sent to ${phone}`, "success");
    await updTask(task.id, "done", { pending_proposal_id: null });
  }

  await sendButtons(ctx.phone, "✅ Mesaj gönderildi.", [
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
}

async function handleAgentDraftEdit(ctx: WaContext, proposalId: string) {
  const supabase = getServiceClient();

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .select("action_data, agent_key")
    .eq("id", proposalId)
    .eq("status", "pending")
    .single();

  if (!proposal) {
    await sendText(ctx.phone, "Bu taslak artık geçerli değil.");
    return;
  }

  const actionData = proposal.action_data as Record<string, unknown>;

  // Start edit session
  const { startSession: startSess, updateSession: updSess } = await import("@/platform/whatsapp/session");
  await startSess(ctx.userId, ctx.tenantId, "agent_draft_edit", "waiting_text");
  await updSess(ctx.userId, "waiting_text", { proposal_id: proposalId });

  await sendText(ctx.phone, `✏️ Mevcut mesaj:\n\n"${actionData.message}"\n\nYeni mesajı yazın:`);
}

async function finalizeDraftEdit(ctx: WaContext, proposalId: string, newText: string) {
  const supabase = getServiceClient();

  const { data: proposal } = await supabase
    .from("agent_proposals")
    .select("*")
    .eq("id", proposalId)
    .eq("status", "pending")
    .single();

  if (!proposal) {
    await sendText(ctx.phone, "Bu taslak artık geçerli değil.");
    return;
  }

  const actionData = proposal.action_data as Record<string, unknown>;
  actionData.message = newText;

  // Update proposal with new text
  await supabase.from("agent_proposals")
    .update({ action_data: actionData, message: proposal.message })
    .eq("id", proposalId);

  // Log edit for Claude to learn user style
  const { saveMessage: savMsg } = await import("@/platform/agents/memory");
  await savMsg(ctx.userId, ctx.tenantId, proposal.agent_key, null, "user",
    `Taslak düzenlendi. Eski: "${(proposal.action_data as Record<string, unknown>).message}" → Yeni: "${newText}"`);

  // Show updated draft with send/edit/cancel
  const phone = actionData.phone as string;
  await sendButtons(ctx.phone,
    `📋 *Mesaj Taslağı (düzenlendi)*\n\nKime: ${phone}\nMesaj: "${newText}"`,
    [
      { id: `agent_send:${proposalId}`, title: "✅ Gönder" },
      { id: `agent_edit:${proposalId}`, title: "✏️ Düzenle" },
      { id: `agent_no:${proposalId}`, title: "❌ İptal" },
    ],
  );
}

// ── /degistir — SaaS + role switch ─────────────────────────────────────

async function handleDegistir(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  // Get all SaaS profiles for this phone
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, tenant_id, display_name, role")
    .eq("whatsapp_phone", ctx.phone);

  if (!profiles?.length) {
    await sendButtons(ctx.phone, "Kayıtlı hesap bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Get tenant names
  const tenantIds = [...new Set(profiles.map(p => p.tenant_id).filter(Boolean))];
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, saas_type")
    .in("id", tenantIds);

  const tenantMap: Record<string, { name: string; saas_type: string }> = {};
  for (const t of tenants || []) tenantMap[t.id] = { name: t.name, saas_type: t.saas_type };

  // Check current view_as_role
  const { data: session } = await supabase
    .from("saas_active_session")
    .select("view_as_role")
    .eq("phone", ctx.phone)
    .maybeSingle();

  const currentViewRole = session?.view_as_role;

  const rows: Array<{ id: string; title: string; description: string }> = [];

  // Get actual DB role (not view_as_role)
  const actualRole = profiles.find(p => {
    const tid = p.tenant_id;
    return tenantMap[tid]?.saas_type === ctx.tenantKey;
  })?.role || "admin";

  const isInSubView = !!currentViewRole; // dealer or employee view active

  if (isInSubView) {
    // In a sub-view → only show reset to admin
    rows.push({
      id: "degistir_role:reset",
      title: "👔 Firma Sahibi Görünümü",
      description: "Kendi menünüze dönün",
    });
  } else {
    // In admin view → show cross-SaaS switch + role switch (if bayi)
    const uniqueSaas = [...new Set(Object.values(tenantMap).map(t => t.saas_type))];
    if (uniqueSaas.length > 1) {
      for (const saasKey of uniqueSaas) {
        const t = Object.values(tenantMap).find(tm => tm.saas_type === saasKey);
        if (t && saasKey !== ctx.tenantKey) {
          rows.push({
            id: `degistir_saas:${saasKey}`,
            title: `🔄 ${t.name}`.substring(0, 24),
            description: `${saasKey} sistemine geç`,
          });
        }
      }
    }

    // Role switch (bayi tenant admin only)
    if (ctx.tenantKey === "bayi" && (actualRole === "admin" || actualRole === "user")) {
      rows.push({
        id: "degistir_role:dealer",
        title: "🏪 Bayi Görünümü",
        description: "Bayinin gördüğü menüyü görün",
      });

      // Check if employee exists
      const { data: employees } = await supabase
        .from("profiles")
        .select("id")
        .eq("invited_by", ctx.userId)
        .eq("role", "employee")
        .limit(1);

      if (employees?.length) {
        rows.push({
          id: "degistir_role:employee",
          title: "👤 Çalışan Görünümü",
          description: "Çalışanın gördüğü menüyü görün",
        });
      } else {
        rows.push({
          id: "degistir_role:no_employee",
          title: "👤 Çalışan Görünümü",
          description: "⚠️ Henüz çalışan atanmadı",
        });
      }
    }
  }

  if (rows.length === 0) {
    await sendButtons(ctx.phone, "Değiştirilecek bir şey yok — tek SaaS ve tek rol kullanıyorsunuz.", [
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const currentTenantName = Object.values(tenantMap).find(t => t.saas_type === ctx.tenantKey)?.name || ctx.tenantKey;
  let text = "🔄 *Değiştir*\n\n";
  text += `Mevcut: *${currentTenantName}*`;
  if (currentViewRole) {
    const roleLabels: Record<string, string> = { dealer: "Bayi", employee: "Çalışan", admin: "Admin" };
    text += ` (${roleLabels[currentViewRole] || currentViewRole} görünümü)`;
  }
  text += "\n\nNe yapmak istersiniz?";

  await sendList(ctx.phone, text, "Seçin", [{ title: "Seçenekler", rows }]);
}
