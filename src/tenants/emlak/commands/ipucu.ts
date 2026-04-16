/**
 * İpucu command — user-triggered "show me all tips" view.
 *
 * Lists available tips as an interactive WA list. Tapping a tip acts like
 * the tip itself (opens CTA).
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendList, sendText } from "@/platform/whatsapp/send";
import { EMLAK_TIPS } from "@/platform/tips/library";
import { resolveUserContext, logTipShown } from "@/platform/tips/picker";

export async function handleIpucu(ctx: WaContext): Promise<void> {
  const userCtx = await resolveUserContext(ctx.userId);
  const eligible = EMLAK_TIPS.filter((t) => t.eligible(userCtx));
  const pool = eligible.length > 0 ? eligible : EMLAK_TIPS;  // fallback: show all

  // WA list rows max 10, max 72 char description, max 24 char title
  const rows = pool.slice(0, 10).map((t) => {
    // First line = title (strip emoji prefix), 2nd+ = description snippet
    const titleMatch = t.text.match(/\*([^*]+)\*/);
    const title = titleMatch ? titleMatch[1] : t.key;
    const body = t.text.replace(/💡\s*\*İpucu\*\s*/, "").split("\n\n")[1] || "";
    return {
      id: `tip:${t.key}`,
      title: (t.cta.title || title).substring(0, 24),
      description: body.substring(0, 72),
    };
  });

  if (rows.length === 0) {
    await sendText(ctx.phone, "💡 Şu an gösterilecek ipucu yok. Daha fazla özellik kullandıkça yeni ipuçları açılacak.");
    return;
  }

  await sendList(ctx.phone,
    "💡 *İpuçları*\n\nİstediğin ipucunu seç — sana hemen o özelliğe götüreyim.",
    "İpuçları",
    [{ title: "Özellikler", rows }],
  );

  // Log the command-triggered tips view (doesn't log individual tip shown)
  void logTipShown; // reference to avoid unused import
}

/**
 * Handle `tip:<key>` callback — user tapped a tip from the list.
 * Execute the tip's CTA (which is a cmd: button).
 */
export async function handleTipCallback(ctx: WaContext, callbackData: string): Promise<void> {
  const tipKey = callbackData.replace("tip:", "");
  const tip = EMLAK_TIPS.find((t) => t.key === tipKey);
  if (!tip) return;

  // Log click
  const { logTipClicked, logTipShown: logShown } = await import("@/platform/tips/picker");
  await logShown(ctx.userId, tipKey).catch(() => {});
  await logTipClicked(ctx.userId, tipKey).catch(() => {});

  // Show the tip body + CTA button
  const { sendButtons } = await import("@/platform/whatsapp/send");
  await sendButtons(ctx.phone, tip.text, [tip.cta]);
}
