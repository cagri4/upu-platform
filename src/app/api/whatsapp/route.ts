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
// Extend default serverless timeout (10s Hobby, 60s Pro) so scraping fits.
// On Hobby this silently caps at 10s but is harmless.
export const maxDuration = 60;

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

    // Extract image media_id if message is a photo
    const imageData = msg.type === "image"
      ? { mediaId: (msg.image as Record<string, string>)?.id || "", caption: (msg.image as Record<string, string>)?.caption || "" }
      : null;

    return {
      phone: msg.from as string,
      name: (contacts?.profile as Record<string, string>)?.name || "",
      messageId: msg.id as string || "",
      type: msg.type as string,
      text: msg.type === "text" ? ((msg.text as Record<string, string>)?.body || "").trim()
        : msg.type === "image" ? (msg.image as Record<string, string>)?.caption?.trim() || ""
        : "",
      interactiveId: msg.type === "interactive"
        ? ((msg.interactive as Record<string, Record<string, string>>)?.button_reply?.id ||
           (msg.interactive as Record<string, Record<string, string>>)?.list_reply?.id || "")
        : "",
      imageMediaId: imageData?.mediaId || null,
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

    // Silently ignore unsupported message types (reactions, stickers,
    // location, contacts, group notifications, etc.). Only process
    // text, interactive (buttons/lists), and image messages.
    const supportedTypes = ["text", "interactive", "image"];
    if (!supportedTypes.includes(parsed.type)) {
      return NextResponse.json({ status: "ok" });
    }

    const { phone, name, messageId, text, interactiveId, imageMediaId } = parsed;
    console.log(`[wa-platform] ${phone}: ${text || interactiveId || (imageMediaId ? "[image]" : "")}`);

    // Log incoming message (fire-and-forget)
    logEvent({ eventType: "message", eventName: "incoming", phone, metadata: { text: text?.substring(0, 200), interactiveId } });

    // Mark as read + typing indicator
    if (messageId) markAsRead(messageId, phone);

    const supabase = getServiceClient();

    // ── Check multi-use invite link (BAYI:CODE format) ──
    const bayiCodeMatch = text?.toUpperCase().match(/BAYI[:\s]+([A-Z0-9]{6,})\b/);
    if (bayiCodeMatch) {
      const linkCode = bayiCodeMatch[1];
      const { data: inviteLink } = await supabase
        .from("bayi_invite_links")
        .select("id, tenant_id, role, permissions, max_uses, used_count, is_active, expires_at, created_by")
        .eq("code", linkCode)
        .eq("is_active", true)
        .single();

      if (inviteLink) {
        // Check expiry
        if (inviteLink.expires_at && new Date(inviteLink.expires_at) < new Date()) {
          await sendText(phone, "❌ Bu davet linkinin süresi dolmuş.");
          return NextResponse.json({ status: "ok" });
        }
        // Check max uses
        if (inviteLink.max_uses && inviteLink.used_count >= inviteLink.max_uses) {
          await sendText(phone, "❌ Bu davet linki kullanım limitine ulaşmış.");
          return NextResponse.json({ status: "ok" });
        }
        // Check if phone already registered in this tenant
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("whatsapp_phone", phone)
          .eq("tenant_id", inviteLink.tenant_id)
          .maybeSingle();

        if (existingProfile) {
          await sendText(phone, "✅ Bu telefon numarası zaten kayıtlı. \"menu\" yazarak başlayabilirsiniz.");
          return NextResponse.json({ status: "ok" });
        }

        // Create auth user + profile
        const { randomBytes } = await import("crypto");
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email: `dealer_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
          email_confirm: true,
          user_metadata: { name: name || phone },
        });

        if (authErr || !authUser.user) {
          await sendText(phone, "❌ Kayıt hatası. Lütfen tekrar deneyin.");
          return NextResponse.json({ status: "ok" });
        }

        // Create profile with dealer role
        await supabase.from("profiles").insert({
          id: authUser.user.id,
          tenant_id: inviteLink.tenant_id,
          display_name: name || phone,
          whatsapp_phone: phone,
          role: inviteLink.role || "dealer",
          permissions: inviteLink.permissions || {},
          invited_by: inviteLink.created_by,
        });

        // Create subscription
        await supabase.from("subscriptions").insert({
          tenant_id: inviteLink.tenant_id,
          user_id: authUser.user.id,
          plan: "trial",
          status: "active",
        });

        // Update used count
        await supabase.from("bayi_invite_links")
          .update({ used_count: (inviteLink.used_count || 0) + 1 })
          .eq("id", inviteLink.id);

        // Set active session
        const { data: t } = await supabase.from("tenants").select("saas_type").eq("id", inviteLink.tenant_id).single();
        if (t) {
          await supabase.from("saas_active_session").upsert({
            phone, active_saas_key: t.saas_type, updated_at: new Date().toISOString(),
          });
        }

        // Get tenant info for welcome
        const { data: tenantInfo } = await supabase.from("tenants").select("name, saas_type").eq("id", inviteLink.tenant_id).single();
        const tenantCfg = tenantInfo ? getTenantByKey(tenantInfo.saas_type) : null;

        const tenantKey = tenantInfo?.saas_type || "bayi";
        const dealerRole = (inviteLink.role as string) || "dealer";

        // No separate welcome text — intro flow (startIntro) sends a single
        // combined greeting. Fallback for non-intro tenants sends its own below.

        const onbCtx: WaContext = {
          phone, userId: authUser.user.id, tenantId: inviteLink.tenant_id,
          tenantKey, userName: name || phone, locale: "tr",
          messageId: "", text: "", interactiveId: "",
          role: (dealerRole as WaContext["role"]),
          permissions: (inviteLink.permissions as Record<string, unknown>) || {},
          dealerId: null,
        };

        const { startIntro } = await import("@/platform/whatsapp/intro");
        const introStarted = dealerRole === "dealer" ? false : await startIntro(onbCtx);

        if (!introStarted) {
          // Non-intro tenants / dealers — short welcome then onboarding
          await sendText(phone, `👋 *Merhaba!*\n\nSisteme hoş geldin. Önce seni tanıyayım — birkaç kısa soru.`);

          if (dealerRole === "dealer") {
            const { startDealerOnboarding } = await import("@/tenants/bayi/commands/dealer-onboarding");
            await startDealerOnboarding({ ...onbCtx, role: "dealer" });
          } else {
            const onbFlow = getOnboardingFlow(tenantKey);
            if (onbFlow) {
              await initOnboarding(authUser.user.id, inviteLink.tenant_id, tenantKey);
              const state = await getOnboardingState(authUser.user.id);
              if (state) await sendOnboardingStep(onbCtx, state);
            } else {
              const { sendButtons: sendBtns } = await import("@/platform/whatsapp/send");
              await sendBtns(phone, "Başlamak için Ana Menü'ye tıklayın:", [
                { id: "cmd:menu", title: "📋 Ana Menü" },
              ]);
            }
          }
        }

        logEvent({ eventType: "signup", eventName: "multi_invite_used", userId: authUser.user.id, tenantId: inviteLink.tenant_id, phone, metadata: { code: linkCode, role: inviteLink.role } });
        return NextResponse.json({ status: "ok" });
      }
    }

    // ── Check universal invite link (any tenant) ──
    // Match standalone 6-8 char hex codes against invite_links table
    const universalCodeMatch = text ? text.trim().toUpperCase().match(/(?:^|\s|:)\s*([A-F0-9]{6,8})\s*$/) : null;
    if (universalCodeMatch) {
      const uCode = universalCodeMatch[1];
      const { data: uLink } = await supabase
        .from("invite_links")
        .select("id, tenant_id, role, permissions, max_uses, used_count, is_active, expires_at, created_by")
        .eq("code", uCode)
        .eq("is_active", true)
        .maybeSingle();

      if (uLink) {
        // Check expiry
        if (uLink.expires_at && new Date(uLink.expires_at) < new Date()) {
          await sendText(phone, "Bu davet linkinin suresi dolmus.");
          return NextResponse.json({ status: "ok" });
        }
        // Check max uses
        if (uLink.max_uses && uLink.used_count >= uLink.max_uses) {
          await sendText(phone, "Bu davet linki kullanim limitine ulasmis.");
          return NextResponse.json({ status: "ok" });
        }
        // Check if phone already registered in this tenant
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("whatsapp_phone", phone)
          .eq("tenant_id", uLink.tenant_id)
          .maybeSingle();

        if (existingProfile) {
          await sendText(phone, "Bu telefon numarasi zaten kayitli. \"menu\" yazarak baslayabilirsiniz.");
          return NextResponse.json({ status: "ok" });
        }

        // Create auth user + profile
        const { randomBytes: rndBytes } = await import("crypto");
        const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
          email: `invite_${Date.now()}_${rndBytes(4).toString("hex")}@placeholder.upudev.nl`,
          email_confirm: true,
          user_metadata: { name: name || phone },
        });

        if (authErr || !authUser.user) {
          await sendText(phone, "Kayit hatasi. Lutfen tekrar deneyin.");
          return NextResponse.json({ status: "ok" });
        }

        // Create profile with role from link
        await supabase.from("profiles").insert({
          id: authUser.user.id,
          tenant_id: uLink.tenant_id,
          display_name: phone,  // Will be updated during onboarding
          whatsapp_phone: phone,
          role: uLink.role || "admin",
          permissions: uLink.permissions || {},
          invited_by: uLink.created_by,
        });

        // Create subscription
        await supabase.from("subscriptions").insert({
          tenant_id: uLink.tenant_id,
          user_id: authUser.user.id,
          plan: "trial",
          status: "active",
        });

        // Increment used_count
        await supabase.from("invite_links")
          .update({ used_count: (uLink.used_count || 0) + 1 })
          .eq("id", uLink.id);

        // Set active SaaS session
        const { data: uTenant } = await supabase.from("tenants").select("name, saas_type").eq("id", uLink.tenant_id).single();
        if (uTenant) {
          await supabase.from("saas_active_session").upsert({
            phone, active_saas_key: uTenant.saas_type, updated_at: new Date().toISOString(),
          });
        }

        const tenantKey = uTenant?.saas_type || "emlak";

        // No separate welcome text — intro flow sends the single combined greeting.

        const onbCtx: WaContext = {
          phone, userId: authUser.user.id, tenantId: uLink.tenant_id,
          tenantKey, userName: name || phone, locale: "tr",
          messageId: "", text: "", interactiveId: "",
          role: (uLink.role as WaContext["role"]) || "admin",
          permissions: (uLink.permissions as Record<string, unknown>) || {},
          dealerId: null,
        };

        // Try intro flow first (emlak etc.); fall back to direct onboarding
        const { startIntro } = await import("@/platform/whatsapp/intro");
        const introStarted = await startIntro(onbCtx);

        if (!introStarted) {
          await sendText(phone, `👋 *Merhaba!*\n\nSisteme hoş geldin. Önce seni tanıyayım — birkaç kısa soru.`);
          const onbFlow = getOnboardingFlow(tenantKey);
          if (onbFlow) {
            await initOnboarding(authUser.user.id, uLink.tenant_id, tenantKey);
            const state = await getOnboardingState(authUser.user.id);
            if (state) await sendOnboardingStep(onbCtx, state);
          } else {
            const { sendButtons: sendBtns } = await import("@/platform/whatsapp/send");
            await sendBtns(phone, "Başlamak için Ana Menü'ye tıklayın:", [
              { id: "cmd:menu", title: "📋 Ana Menü" },
            ]);
          }
        }

        logEvent({ eventType: "signup", eventName: "universal_invite_used", userId: authUser.user.id, tenantId: uLink.tenant_id, phone, metadata: { code: uCode, role: uLink.role } });
        return NextResponse.json({ status: "ok" });
      }
      // If no match in invite_links, fall through to single-use check below
    }

    // ── Check single-use invite code ──
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
          // Narrative intro — explain the concept before onboarding questions
          await sendText(phone,
            `Merhaba ${userName}! 👋\n\n` +
            `*${tenantName}* sistemine hoş geldiniz!\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n\n` +
            `🏢 *Ekibiniz hazır!*\n\n` +
            `5 sanal elemanınız sizin için çalışmaya başladı. ` +
            `Görevleri tamamladıkça onları geliştirin — daha yetenekli elemanlar, daha çok satış.\n\n` +
            `Önce sizi tanıyalım — birkaç kısa soru.`
          );

          // Init onboarding and send first step
          await initOnboarding(invite.user_id, invite.tenant_id, tenantKey);
          const state = await getOnboardingState(invite.user_id);
          if (state) {
            const ctx: WaContext = {
              phone, userId: invite.user_id, tenantId: invite.tenant_id,
              tenantKey, userName, locale: "tr",
              messageId: "", text: "", interactiveId: "",
              role: "admin", permissions: {}, dealerId: null,
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
      .select("id, tenant_id, display_name, preferred_locale, role, permissions, dealer_id")
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
      .select("active_saas_key, view_as_role")
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

    // Build context — use view_as_role if set (for admin testing dealer/employee view)
    const actualRole = (user.role as WaContext["role"]) || "admin";
    const effectiveRole = activeSession?.view_as_role
      ? (activeSession.view_as_role as WaContext["role"])
      : actualRole;

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
      role: effectiveRole,
      permissions: (user.permissions as Record<string, unknown>) || {},
      dealerId: user.dealer_id || null,
    };

    // ── Check if dealer needs onboarding (dealer_id is null) ──
    if (actualRole === "dealer" && !user.dealer_id && tenantKey === "bayi") {
      // Check if dealer onboarding session is active
      const { getSession: getDealerSession } = await import("@/platform/whatsapp/session");
      const dealerSess = await getDealerSession(user.id);
      if (!dealerSess || dealerSess.command !== "dealer_onboard") {
        // Start dealer onboarding
        const { startDealerOnboarding } = await import("@/tenants/bayi/commands/dealer-onboarding");
        await startDealerOnboarding(ctx);
        return NextResponse.json({ status: "ok" });
      }
      // If session active, fall through to step handler in routeCommand
    }

    // ── Check onboarding state — intercept if not completed ──
    const onbState = await getOnboardingState(user.id);
    if (onbState && !onbState.completed_at) {
      // Escape hatches: cmd:menu, cmd:devam, or text commands should bypass onboarding
      const isNavEscape =
        ctx.interactiveId === "cmd:menu" ||
        ctx.interactiveId === "cmd:devam" ||
        ["menu", "menü", "ana menü", "ana menu", "devam", "devam et", "göreve devam", "gorevlere devam", "görevlere devam", "iptal"]
          .includes((ctx.text || "").toLowerCase().trim());
      if (isNavEscape) {
        await routeCommand(ctx);
        return NextResponse.json({ status: "ok" });
      }
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

    // ── Handle incoming photo for active foto_upload session ──
    if (imageMediaId) {
      const { getSession } = await import("@/platform/whatsapp/session");
      const fotoSession = await getSession(user.id);
      if (fotoSession?.command === "foto_upload") {
        try {
          const { handlePhotoUpload } = await import("@/platform/whatsapp/photo-upload");
          await handlePhotoUpload(ctx, imageMediaId, fotoSession);
        } catch (photoErr) {
          console.error("[wa-platform] photo upload error:", photoErr);
          await sendText(phone, "❌ Fotoğraf yüklenirken hata oluştu. Tekrar deneyin.");
        }
        return NextResponse.json({ status: "ok" });
      }
      // No active foto session — ignore image or tell user
      await sendText(phone, "📷 Fotoğraf almak için önce /fotograf komutuyla mülk seçin.");
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
