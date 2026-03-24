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

    // Resolve user
    const supabase = getServiceClient();
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

    // Resolve tenant key from user's tenant_id
    let tenantKey = "emlak";
    if (user.tenant_id) {
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
    await routeCommand(ctx);

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[wa-platform] Error:", err);
    return NextResponse.json({ status: "ok" });
  }
}
