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

// (reserved) — previously used to skip nav when existing button was cmd:menu.
// Now we always append the nav footer so both Göreve Devam + Ana Menü are visible,
// even if the primary message already has an Ana Menü button. This yields a bit of
// redundancy but matches the UX requirement: "every screen needs both nav actions".

// Send a separate follow-up message with nav buttons (Görevlere Devam + Ana Menü)
export async function sendNavFooter(phone: string) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;
  await fetch(`${WA_API}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to: phone, type: "interactive",
      interactive: {
        type: "button",
        body: { text: "🔀 Navigasyon:" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "cmd:devam", title: "▶️ Göreve Devam" } },
            { type: "reply", reply: { id: "cmd:menu", title: "🏠 Ana Menü" } },
          ],
        },
      },
    }),
  }).catch(err => console.error("[wa:send] nav footer error:", err));
}

export async function sendButtons(
  phone: string,
  text: string,
  buttons: Array<{ id: string; title: string }>,
  opts?: { skipNav?: boolean },
) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  const validButtons = buttons.slice(0, 3).filter(b => b.id && b.title);
  if (validButtons.length === 0) {
    await sendText(phone, text);
    return;
  }
  // Detect if this call IS itself a nav footer (to avoid infinite chain)
  const isNavFooter = validButtons.length === 2 &&
    validButtons.every(b => b.id === "cmd:menu" || b.id === "cmd:devam");
  const shouldAddNav = !isNavFooter && !opts?.skipNav;

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
    } else if (shouldAddNav) {
      await sendNavFooter(phone);
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
  opts?: { skipNav?: boolean },
) {
  const { token, phoneId } = getConfig();
  if (!token || !phoneId) return;

  const shouldAddNav = !opts?.skipNav;

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
    } else if (shouldAddNav) {
      await sendNavFooter(phone);
    }
  } catch (err) {
    console.error("[wa:send] list error:", err);
  }
}

// Send a CTA URL button message — hides long URL behind a clickable button label.
// Uses WhatsApp Cloud API interactive "cta_url" type (1 URL button per message).
export async function sendUrlButton(
  phone: string,
  text: string,
  buttonLabel: string,
  url: string,
  opts?: { skipNav?: boolean },
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
          type: "cta_url",
          body: { text: truncateText(text, 1024) },
          action: {
            name: "cta_url",
            parameters: {
              display_text: buttonLabel.substring(0, 20),
              url,
            },
          },
        },
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error("[wa:send] cta_url API error:", resp.status, err);
      // Fallback: send text with URL inline
      await sendText(phone, `${text}\n\n🔗 ${url}`);
    } else if (!opts?.skipNav) {
      await sendNavFooter(phone);
    }
  } catch (err) {
    console.error("[wa:send] cta_url error:", err);
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
