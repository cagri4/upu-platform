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

// Split text into chunks near line breaks to stay under WhatsApp's 4096-char limit
function splitForWhatsApp(text: string, chunkLimit = 3900): string[] {
  if (text.length <= chunkLimit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > chunkLimit) {
    let cut = remaining.lastIndexOf("\n", chunkLimit);
    if (cut < chunkLimit * 0.5) cut = chunkLimit; // no good line break — hard cut
    chunks.push(remaining.substring(0, cut).trimEnd());
    remaining = remaining.substring(cut).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

export async function sendText(phone: string, text: string) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  const parts = splitForWhatsApp(text);
  for (const part of parts) {
    await fetch(`${WA_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone, type: "text",
        text: { body: part },
      }),
    }).catch(err => console.error("[wa:send] text error:", err));
  }
}

// Decide whether to auto-append "🏠 Menü" as a nav button/row.
// Skip if any existing id is cmd:menu, cmd:devam, or a known "escape" action.
function hasNavAlready(ids: string[]): boolean {
  return ids.some(id =>
    id === "cmd:menu" ||
    id === "cmd:devam" ||
    id.startsWith("cmd:menu") ||
    id.startsWith("cmd:devam"),
  );
}

export async function sendButtons(
  phone: string,
  text: string,
  buttons: Array<{ id: string; title: string }>,
) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  // Auto-append "🏠 Menü" if there's room (≤2 buttons) and no nav already
  const existing = buttons.filter(b => b.id && b.title);
  const withNav = existing.length <= 2 && !hasNavAlready(existing.map(b => b.id))
    ? [...existing, { id: "cmd:menu", title: "🏠 Menü" }]
    : existing;
  const validButtons = withNav.slice(0, 3);
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

  // Auto-append "🏠 Ana Menü" row if there's room and no nav already
  const allIds = sections.flatMap(s => s.rows.map(r => r.id));
  const totalRows = allIds.length;
  let finalSections = sections;
  if (totalRows < 10 && !hasNavAlready(allIds) && sections.length > 0) {
    finalSections = sections.map((s, i) => i === sections.length - 1
      ? { ...s, rows: [...s.rows, { id: "cmd:menu", title: "🏠 Ana Menü" }] }
      : s,
    );
  }

  try {
    const resp = await fetch(`${WA_API}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: phone, type: "interactive",
        interactive: {
          type: "list",
          body: { text: truncateText(text, 1024) },
          action: { button: buttonText, sections: finalSections },
        },
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error("[wa:send] list API error:", resp.status, err);
      // Fallback to text message
      const fallback = finalSections.map(s => `*${s.title}*\n` + s.rows.map(r => `  ${r.title}`).join("\n")).join("\n\n");
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
