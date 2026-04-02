/**
 * UPU Platform — WhatsApp Webhook Endpoint
 *
 * Receives messages forwarded from upu-whatsapp-gateway.
 * Resolves user + tenant, then routes to tenant-specific command handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { logEvent, logError, logOnboarding } from "@/platform/analytics/logger";
import { getServiceClient } from "@/platform/auth/supabase";
import { routeCommand } from "@/platform/whatsapp/router";
import { markAsRead, sendText } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";
import { getTenantByKey } from "@/tenants/config";
import {
  registerOnboardingFlow,
  getOnboardingState,
  getOnboardingFlow,
  initOnboarding,
  sendOnboardingStep,
  handleOnboardingInput,
} from "@/platform/whatsapp/onboarding";
import { emlakOnboardingFlow } from "@/tenants/emlak/onboarding-flow";

export const dynamic = "force-dynamic";

// ─── Register onboarding flows ────────────────────────────────────────────
registerOnboardingFlow(emlakOnboardingFlow);
import { siteyonetimOnboardingFlow } from "@/tenants/siteyonetim/onboarding-flow";
registerOnboardingFlow(siteyonetimOnboardingFlow);
import { bayiOnboardingFlow } from "@/tenants/bayi/onboarding-flow";
registerOnboardingFlow(bayiOnboardingFlow);
import { otelOnboardingFlow } from "@/tenants/otel/onboarding-flow";
registerOnboardingFlow(otelOnboardingFlow);
import { muhasebeOnboardingFlow } from "@/tenants/muhasebe/onboarding-flow";
registerOnboardingFlow(muhasebeOnboardingFlow);

// ─── Register agent setup flows ──────────────────────────────────────────
import { registerAgentSetup } from "@/platform/agents/setup";
import { portfoySetup, satisSetup, medyaSetup, pazarSetup, sekreterSetup } from "@/tenants/emlak/agents/setup-flows";
registerAgentSetup(portfoySetup);
registerAgentSetup(satisSetup);
registerAgentSetup(medyaSetup);
registerAgentSetup(pazarSetup);
registerAgentSetup(sekreterSetup);

// ─── Register site yonetim agent setup flows ────────────────────────────
import { muhasebeciSetup, sySekreterSetup, teknisyenSetup, hukukSetup } from "@/tenants/siteyonetim/agents/setup-flows";
registerAgentSetup(muhasebeciSetup);
registerAgentSetup(sySekreterSetup);
registerAgentSetup(teknisyenSetup);
registerAgentSetup(hukukSetup);

// ─── Register bayi agent setup flows ────────────────────────────────────
import {
  asistanSetup as bayiAsistanSetup,
  satisMuduruSetup as bayiSatisMuduruSetup,
  satisTemsilcisiSetup as bayiSatisTemsilcisiSetup,
  muhasebeciSetup as bayiMuhasebeciSetup,
  tahsildarSetup as bayiTahsildarSetup,
  depocuSetup as bayiDepocuSetup,
  lojistikciSetup as bayiLojistikciSetup,
  urunYoneticisiSetup as bayiUrunYoneticisiSetup,
} from "@/tenants/bayi/agents/setup-flows";
registerAgentSetup(bayiAsistanSetup);
registerAgentSetup(bayiSatisMuduruSetup);
registerAgentSetup(bayiSatisTemsilcisiSetup);
registerAgentSetup(bayiMuhasebeciSetup);
registerAgentSetup(bayiTahsildarSetup);
registerAgentSetup(bayiDepocuSetup);
registerAgentSetup(bayiLojistikciSetup);
registerAgentSetup(bayiUrunYoneticisiSetup);

// ─── Register otel agent setup flows ───────────────────────────────────
import {
  resepsiyonSetup as otelResepsiyonSetup,
  rezervasyonSetup as otelRezervasyonSetup,
  katHizmetleriSetup as otelKatHizmetleriSetup,
  misafirDeneyimiSetup as otelMisafirDeneyimiSetup,
} from "@/tenants/otel/agents/setup-flows";
registerAgentSetup(otelResepsiyonSetup);
registerAgentSetup(otelRezervasyonSetup);
registerAgentSetup(otelKatHizmetleriSetup);
registerAgentSetup(otelMisafirDeneyimiSetup);

// ─── Register muhasebe agent setup flows ───────────────────────────────
import {
  faturaUzmaniSetup as muhFaturaUzmaniSetup,
  muhSekreterSetup,
  vergiUzmaniSetup as muhVergiUzmaniSetup,
  tahsilatUzmaniSetup as muhTahsilatUzmaniSetup,
} from "@/tenants/muhasebe/agents/setup-flows";
registerAgentSetup(muhFaturaUzmaniSetup);
registerAgentSetup(muhSekreterSetup);
registerAgentSetup(muhVergiUzmaniSetup);
registerAgentSetup(muhTahsilatUzmaniSetup);

// ─── Register market onboarding flow ───────────────────────────────────
import { marketOnboardingFlow } from "@/tenants/market/onboarding-flow";
registerOnboardingFlow(marketOnboardingFlow);

// ─── Register market agent setup flows ─────────────────────────────────
import {
  stokSorumlusuSetup as mktStokSorumlusuSetup,
  siparisYoneticisiSetup as mktSiparisYoneticisiSetup,
  finansAnalistiSetup as mktFinansAnalistiSetup,
} from "@/tenants/market/agents/setup-flows";
registerAgentSetup(mktStokSorumlusuSetup);
registerAgentSetup(mktSiparisYoneticisiSetup);
registerAgentSetup(mktFinansAnalistiSetup);

// ─── Parse Meta webhook payload ────────────────────────────────────────────

function parseWebhook(payload: Record<string, unknown>) {
  try {
    const entry = (payload.entry as Array<Record<string, unknown>>)?.[0];
    const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
    const value = changes?.value as Record<string, unknown>;
    const messages = value?.messages as Array<Record<string, unknown>>;
    if (!messages?.[0]) return null;

    const msg = messages[0];
    const contacts = (value?.contacts as Array<Record<string, unknown>>)?.[0];

    return {
      phone: msg.from as string,
      name: (contacts?.profile as Record<string, string>)?.name || "",
      messageId: msg.id as string || "",
      type: msg.type as string,
      text: msg.type === "text" ? ((msg.text as Record<string, string>)?.body || "").trim() : "",
      interactiveId: msg.type === "interactive"
        ? ((msg.interactive as Record<string, Record<string, string>>)?.button_reply?.id ||
           (msg.interactive as Record<string, Record<string, string>>)?.list_reply?.id || "")
        : "",
    };
  } catch {
    return null;
  }
}

// ─── GET: Webhook verification ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// ─── POST: Handle incoming message ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const parsed = parseWebhook(payload);

    if (!parsed) {
      return NextResponse.json({ status: "ok" });
    }

    const { phone, name, messageId, text, interactiveId } = parsed;
    console.log(`[wa-platform] ${phone}: ${text || interactiveId}`);

    // Log incoming message (fire-and-forget)
    logEvent({ eventType: "message", eventName: "incoming", phone, metadata: { text: text?.substring(0, 200), interactiveId } });

    // Mark as read + typing indicator
    if (messageId) markAsRead(messageId, phone);

    const supabase = getServiceClient();

    // ── Check invite code BEFORE resolving user ──
    const codeMatch = text
      ? text.toUpperCase().match(/KOD(?:U|UM)?[:\s]+([A-Z0-9]{6})\b/) ||
        text.toUpperCase().match(/^([A-Z0-9]{6})$/)
      : null;

    if (codeMatch) {
      const inviteCode = codeMatch[1];
      console.log(`[wa-platform] Invite code detected: ${inviteCode}`);

      const { data: invite } = await supabase
        .from("invite_codes")
        .select("user_id, tenant_id, status")
        .eq("code", inviteCode)
        .single();

      if (invite && invite.status === "pending") {
        // Link phone to user (don't clear other profiles — same phone can be on multiple SaaS)
        await supabase.from("profiles").update({ whatsapp_phone: phone }).eq("id", invite.user_id);

        // Mark invite as used
        await supabase.from("invite_codes").update({ status: "used" }).eq("code", inviteCode);

        // Set active session to this SaaS (so user lands in the right one)
        const { data: invTenant } = await supabase.from("tenants").select("saas_type").eq("id", invite.tenant_id).single();
        if (invTenant) {
          await supabase.from("saas_active_session").upsert({
            phone,
            active_saas_key: invTenant.saas_type,
            updated_at: new Date().toISOString(),
          });
        }

        // Get user info
        const { data: invitedUser } = await supabase
          .from("profiles")
          .select("display_name, tenant_id")
          .eq("id", invite.user_id)
          .single();

        // Get tenant info
        let tenantName = "Platform";
        let tenantKey = "emlak";
        if (invitedUser?.tenant_id) {
          const { data: t } = await supabase.from("tenants").select("name, saas_type").eq("id", invitedUser.tenant_id).single();
          if (t) { tenantName = t.name; tenantKey = t.saas_type; }
        }

        // Check if onboarding flow exists for this tenant
        const onbFlow = getOnboardingFlow(tenantKey);
        const userName = invitedUser?.display_name || "";
        const tenantCfg = getTenantByKey(tenantKey);
        const features = tenantCfg?.welcomeFeatures || "iş süreçlerinizi";

        if (onbFlow) {
          const { sendButtons: sendBtns } = await import("@/platform/whatsapp/send");
          await sendBtns(phone,
            `Merhaba ${userName}! 👋\n\n` +
            `*${tenantName}* sistemine hoş geldiniz!\n\n` +
            `Bu sistem, WhatsApp üzerinden size yardımcı olan AI destekli sanal çalışanlardan oluşuyor. ` +
            `${features} tek bir sohbetten halledebilirsiniz.\n\n` +
            `Önce sizi hızlıca tanıyalım — birkaç kısa soru soracağım. Hazır mısınız?`,
            [{ id: "cmd:menu", title: "📋 Ana Menü" }],
          );

          // Init onboarding and send first step
          await initOnboarding(invite.user_id, invite.tenant_id, tenantKey);
          const state = await getOnboardingState(invite.user_id);
          if (state) {
            const ctx: WaContext = {
              phone, userId: invite.user_id, tenantId: invite.tenant_id,
              tenantKey, userName, locale: "tr",
              messageId: "", text: "", interactiveId: "",
            };
            await sendOnboardingStep(ctx, state);
          }
        } else {
          const { sendButtons: sendBtns } = await import("@/platform/whatsapp/send");
          await sendBtns(phone,
            `Merhaba ${userName}! 👋\n\n` +
            `*${tenantName}* sistemine hoş geldiniz!\n\n` +
            `Bu sistem, WhatsApp üzerinden size yardımcı olan AI destekli sanal çalışanlardan oluşuyor. ` +
            `${features} tek bir sohbetten halledebilirsiniz.\n\n` +
            `Başlamak için aşağıdaki Ana Menü butonuna tıklayın veya "menu" yazın.`,
            [{ id: "cmd:menu", title: "📋 Ana Menü" }],
          );
        }
        // Log signup event
        logEvent({ eventType: "signup", eventName: "invite_code_used", userId: invite.user_id, tenantId: invite.tenant_id, phone, metadata: { inviteCode } });
        return NextResponse.json({ status: "ok" });
      }
    }

    // ── Resolve user by phone (may have multiple profiles across SaaS) ──
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, tenant_id, display_name, preferred_locale")
      .eq("whatsapp_phone", phone)
      .order("created_at", { ascending: false });

    if (!allProfiles?.length) {
      await sendText(phone,
        "Merhaba! Davet kodunuz varsa lütfen gönderin.\nKod almak için yöneticinize başvurun."
      );
      return NextResponse.json({ status: "ok" });
    }

    // Resolve tenant key — check active SaaS session first
    let tenantKey = "emlak";
    const { data: activeSession } = await supabase
      .from("saas_active_session")
      .select("active_saas_key")
      .eq("phone", phone)
      .maybeSingle();

    if (activeSession?.active_saas_key) {
      tenantKey = activeSession.active_saas_key;
    } else if (allProfiles[0].tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("saas_type")
        .eq("id", allProfiles[0].tenant_id)
        .single();
      if (tenant) tenantKey = tenant.saas_type;
    }

    // Pick the profile matching the active tenant (or first if no match)
    let user = allProfiles[0];
    if (allProfiles.length > 1) {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("id")
        .eq("saas_type", tenantKey)
        .single();
      if (tenantRow) {
        const match = allProfiles.find(p => p.tenant_id === tenantRow.id);
        if (match) user = match;
      }
    }

    // Build context
    const ctx: WaContext = {
      phone,
      userId: user.id,
      tenantId: user.tenant_id || "",
      tenantKey,
      userName: user.display_name || name,
      locale: user.preferred_locale || "tr",
      messageId,
      text,
      interactiveId,
    };

    // ── Check onboarding state — intercept if not completed ──
    const onbState = await getOnboardingState(user.id);
    if (onbState && !onbState.completed_at) {
      try {
        logOnboarding(ctx, onbState.current_step || "unknown");
        await handleOnboardingInput(ctx, onbState);
      } catch (onbErr) {
        console.error("[wa-platform] onboarding error:", onbErr);
        logError(ctx, onbErr instanceof Error ? onbErr.message : String(onbErr), { context: "onboarding" });
        await sendText(phone, "Kurulum sırasında hata oluştu. \"menu\" yazarak devam edebilirsiniz.");
      }
      return NextResponse.json({ status: "ok" });
    }

    // Route to tenant command handler
    try {
      console.log("[wa-platform] Before routeCommand, tenantKey:", tenantKey, "userId:", user.id);
      const cmdStart = Date.now();
      await routeCommand(ctx);
      const cmdDuration = Date.now() - cmdStart;
      console.log("[wa-platform] After routeCommand — success");
      logEvent({ eventType: "session", eventName: "request_complete", userId: user.id, tenantId: user.tenant_id || undefined, tenantKey, phone, durationMs: cmdDuration });
    } catch (routeErr) {
      console.error("[wa-platform] routeCommand error:", routeErr instanceof Error ? routeErr.message : routeErr);
      logError(ctx, routeErr instanceof Error ? routeErr.message : String(routeErr), { context: "routeCommand" });
      try {
        await sendText(phone, "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin veya \"menu\" yazın.");
      } catch {
        // Last resort — can't send to user
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[wa-platform] Webhook error:", err);
    logEvent({ eventType: "error", eventName: "webhook_error", errorMessage: err instanceof Error ? err.message : String(err), success: false });
    return NextResponse.json({ status: "ok" });
  }
}
