/**
 * UPU Platform — WhatsApp Webhook Endpoint
 *
 * Receives messages forwarded from upu-whatsapp-gateway.
 * Routes to correct tenant handler based on tenant config.
 *
 * This is the PLATFORM webhook — each tenant's commands are handled here.
 * Eventually this will replace individual Supabase Edge Functions.
 *
 * For now: receives message, identifies tenant + user, routes to handler.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getTenantByKey, type TenantConfig } from "@/tenants/config";

export const dynamic = "force-dynamic";

// ─── Parse Meta webhook payload ────────────────────────────────────────────

interface ParsedMessage {
  phone: string;
  name: string;
  messageId: string;
  type: string;
  text: string;
  interactiveId: string;
}

function parseWebhook(payload: Record<string, unknown>): ParsedMessage | null {
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

// ─── WhatsApp API helpers ──────────────────────────────────────────────────

const WA_API = "https://graph.facebook.com/v23.0";

async function sendText(phone: string, text: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;

  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
  }).catch(err => console.error("[wa] sendText error:", err));
}

async function sendButtons(phone: string, text: string, buttons: Array<{ id: string; title: string }>) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;

  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: "reply",
            reply: { id: b.id, title: b.title.substring(0, 20) },
          })),
        },
      },
    }),
  }).catch(err => console.error("[wa] sendButtons error:", err));
}

// ─── Resolve user from phone ───────────────────────────────────────────────

async function resolveUser(phone: string) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, tenant_id, display_name, preferred_locale")
    .eq("whatsapp_phone", phone)
    .maybeSingle();
  return data;
}

// ─── Resolve tenant from user or phone registry ────────────────────────────

async function resolveTenant(phone: string, userTenantId: string | null): Promise<TenantConfig | null> {
  if (userTenantId) {
    const supabase = getServiceClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("saas_type")
      .eq("id", userTenantId)
      .single();
    if (tenant) return getTenantByKey(tenant.saas_type);
  }

  // Fallback: check phone registry
  const supabase = getServiceClient();
  const { data: reg } = await supabase
    .from("saas_phone_registry")
    .select("saas_key")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();

  if (reg) return getTenantByKey(reg.saas_key);
  return getTenantByKey("emlak"); // Default
}

// ─── GET: Webhook verification (for direct Meta registration) ──────────────

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

    const { phone, name, text } = parsed;
    console.log(`[wa-platform] Message from ${phone}: ${text}`);

    // Resolve user and tenant
    const user = await resolveUser(phone);
    const tenant = await resolveTenant(phone, user?.tenant_id || null);

    if (!user) {
      // Unknown user — send welcome + registration info
      await sendText(phone,
        `Merhaba! ${tenant?.name || "UPU Platform"}'a hoş geldiniz.\n\n` +
        `Davet kodunuz varsa lütfen gönderin.\n` +
        `Kod almak için yöneticinize başvurun.`
      );
      return NextResponse.json({ status: "ok" });
    }

    // ── Command handling ──
    // For now, basic command parsing + help menu
    const lowerText = text.toLowerCase().trim();

    if (lowerText === "menu" || lowerText === "help" || lowerText === "yardım" || lowerText === "merhaba") {
      if (tenant?.employees && tenant.employees.length > 0) {
        let menuText = `${tenant.icon} ${tenant.name}\n\nSanal ekibiniz:\n\n`;
        for (const emp of tenant.employees) {
          menuText += `${emp.icon} *${emp.name}*\n`;
          menuText += `   ${emp.commands.slice(0, 3).join(", ")}${emp.commands.length > 3 ? "..." : ""}\n\n`;
        }
        menuText += `Komut adını yazarak kullanabilirsiniz.`;
        await sendText(phone, menuText);
      } else {
        await sendText(phone, "Komut sistemi henüz kurulmamış. Yöneticinize başvurun.");
      }
      return NextResponse.json({ status: "ok" });
    }

    // Check if text matches any tenant command
    if (tenant?.employees) {
      for (const emp of tenant.employees) {
        if (emp.commands.includes(lowerText)) {
          await sendButtons(phone,
            `${emp.icon} ${emp.name} — ${lowerText}\n\nBu komut yakında aktif olacak.`,
            [{ id: "help:main", title: "Ana Menü" }],
          );
          return NextResponse.json({ status: "ok" });
        }
      }
    }

    // Unrecognized command
    await sendText(phone, `Komutu anlamadım. Yardım için "menu" yazın.`);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[wa-platform] Error:", err);
    return NextResponse.json({ status: "ok" });
  }
}
