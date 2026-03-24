/**
 * WhatsApp message sending helpers — shared across all tenants
 */

const WA_API = "https://graph.facebook.com/v23.0";

function getConfig() {
  return {
    token: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  };
}

export async function sendText(phone: string, text: string) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: phone, type: "text",
      text: { body: text },
    }),
  }).catch(err => console.error("[wa:send] text error:", err));
}

export async function sendButtons(
  phone: string,
  text: string,
  buttons: Array<{ id: string; title: string }>,
) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: phone, type: "interactive",
      interactive: {
        type: "button",
        body: { text },
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: "reply", reply: { id: b.id, title: b.title.substring(0, 20) },
          })),
        },
      },
    }),
  }).catch(err => console.error("[wa:send] buttons error:", err));
}

export async function sendList(
  phone: string,
  text: string,
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: phone, type: "interactive",
      interactive: {
        type: "list",
        body: { text },
        action: { button: buttonText, sections },
      },
    }),
  }).catch(err => console.error("[wa:send] list error:", err));
}

export async function sendDocument(
  phone: string,
  url: string,
  filename: string,
  caption?: string,
) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: phone, type: "document",
      document: { link: url, filename, ...(caption ? { caption } : {}) },
    }),
  }).catch(err => console.error("[wa:send] document error:", err));
}

export async function markAsRead(messageId: string, phone: string) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", status: "read", message_id: messageId,
      typing_indicator: { type: "text" },
    }),
  }).catch(() => {});
}
