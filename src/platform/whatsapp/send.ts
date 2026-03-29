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

function truncateText(text: string, limit = 4000): string {
  if (text.length <= limit) return text;
  return text.substring(0, limit - 100) + "\n\n... (devamı için komutu tekrar yazın)";
}

export async function sendText(phone: string, text: string) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: phone, type: "text",
      text: { body: truncateText(text) },
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

  const validButtons = buttons.slice(0, 3).filter(b => b.id && b.title);
  if (validButtons.length === 0) {
    // No valid buttons — fallback to text
    await sendText(phone, text);
    return;
  }

  try {
    const resp = await fetch(`${WA_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone, type: "interactive",
        interactive: {
          type: "button",
          body: { text: truncateText(text, 1024) },
          action: {
            buttons: validButtons.map(b => ({
              type: "reply", reply: { id: b.id, title: b.title.substring(0, 20) },
            })),
          },
        },
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error("[wa:send] buttons API error:", resp.status, err);
      await sendText(phone, text);
    }
  } catch (err) {
    console.error("[wa:send] buttons error:", err);
  }
}

export async function sendList(
  phone: string,
  text: string,
  buttonText: string,
  sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>,
) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  try {
    const resp = await fetch(`${WA_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone, type: "interactive",
        interactive: {
          type: "list",
          body: { text: truncateText(text, 1024) },
          action: { button: buttonText, sections },
        },
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error("[wa:send] list API error:", resp.status, err);
      // Fallback to text message
      const fallback = sections.map(s => `*${s.title}*\n` + s.rows.map(r => `  ${r.title}`).join("\n")).join("\n\n");
      await sendText(phone, text + "\n\n" + fallback);
    }
  } catch (err) {
    console.error("[wa:send] list error:", err);
  }
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
