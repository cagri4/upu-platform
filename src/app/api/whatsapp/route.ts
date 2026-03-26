/**
 * UPU Platform — WhatsApp Webhook Endpoint
 *
 * Receives messages forwarded from upu-whatsapp-gateway.
 * Resolves user + tenant, then routes to tenant-specific command handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { routeCommand } from "@/platform/whatsapp/router";
import { markAsRead, sendText } from "@/platform/whatsapp/send";
import type { WaContext } from "@/platform/whatsapp/types";

export const dynamic = "force-dynamic";

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
        // Clear old phone binding if exists
        const { data: oldProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("whatsapp_phone", phone)
          .maybeSingle();

        if (oldProfile && oldProfile.id !== invite.user_id) {
          await supabase.from("profiles").update({ whatsapp_phone: null }).eq("id", oldProfile.id);
        }

        // Link phone to user
        await supabase.from("profiles").update({ whatsapp_phone: phone }).eq("id", invite.user_id);

        // Mark invite as used
        await supabase.from("invite_codes").update({ status: "used" }).eq("code", inviteCode);

        // Get user info
        const { data: invitedUser } = await supabase
          .from("profiles")
          .select("display_name, tenant_id")
          .eq("id", invite.user_id)
          .single();

        // Get tenant info
        let tenantName = "Platform";
        if (invitedUser?.tenant_id) {
          const { data: t } = await supabase.from("tenants").select("name").eq("id", invitedUser.tenant_id).single();
          if (t) tenantName = t.name;
        }

        await sendText(phone,
          `Hoş geldiniz ${invitedUser?.display_name || ""}! 🎉\n\n` +
          `${tenantName} sistemine başarıyla kaydoldunuz.\n\n` +
          `💡 "menu" yazarak komutlara ulaşabilirsiniz.`
        );
        return NextResponse.json({ status: "ok" });
      }
    }

    // ── Resolve user by phone ──
    const { data: user } = await supabase
      .from("profiles")
      .select("id, tenant_id, display_name, preferred_locale")
      .eq("whatsapp_phone", phone)
      .maybeSingle();

    if (!user) {
      await sendText(phone,
        "Merhaba! Davet kodunuz varsa lütfen gönderin.\nKod almak için yöneticinize başvurun."
      );
      return NextResponse.json({ status: "ok" });
    }

    // Resolve tenant key — check active SaaS session first, then profile
    let tenantKey = "emlak";
    const { data: activeSession } = await supabase
      .from("saas_active_session")
      .select("active_saas_key")
      .eq("phone", phone)
      .maybeSingle();

    if (activeSession?.active_saas_key) {
      tenantKey = activeSession.active_saas_key;
    } else if (user.tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("saas_type")
        .eq("id", user.tenant_id)
        .single();
      if (tenant) tenantKey = tenant.saas_type;
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

    // Route to tenant command handler
    try {
      console.log("[wa-platform] Before routeCommand, tenantKey:", tenantKey, "userId:", user.id);
      await routeCommand(ctx);
      console.log("[wa-platform] After routeCommand — success");
    } catch (routeErr) {
      console.error("[wa-platform] routeCommand error:", routeErr);
      try {
        await sendText(phone, "Bir hata oluştu.\n\nHata: " + (routeErr instanceof Error ? routeErr.message : String(routeErr)));
      } catch (sendErr) {
        console.error("[wa-platform] sendText in catch also failed:", sendErr);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[wa-platform] Webhook error:", err);
    return NextResponse.json({ status: "ok" });
  }
}
