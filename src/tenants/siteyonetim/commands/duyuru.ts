/**
 * /duyuru <mesaj> — Yonetici duyuru gonderme (tum sakine broadcast)
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getManagerContext } from "./helpers";

export async function handleDuyuru(ctx: WaContext): Promise<void> {
  try {
    const mc = await getManagerContext(ctx.userId);
    if (!mc) {
      await sendButtons(ctx.phone, "Bu komut sadece yoneticiler icindir.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Extract message text (remove command prefix)
    const text = ctx.text.replace(/^\/?\s*duyuru\s*/i, "").trim();

    if (!text) {
      await sendText(
        ctx.phone,
        "Kullanim: duyuru <mesaj metni>\n\nOrnek: duyuru Yarin su kesintisi olacaktir.",
      );
      return;
    }

    const supabase = getServiceClient();

    // Get all user_ids linked to this building
    const { data: links } = await supabase
      .from("sy_user_residents")
      .select("user_id")
      .eq("building_id", mc.building.id);

    if (!links || links.length === 0) {
      await sendButtons(ctx.phone, "Binada kayitli sakin bulunamadi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Get their WhatsApp phones from profiles
    const userIds = links.map((l: any) => l.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("whatsapp_phone")
      .in("id", userIds);

    const phones = (profiles || [])
      .map((p: any) => p.whatsapp_phone)
      .filter((p: string | null): p is string => !!p);

    if (phones.length === 0) {
      await sendButtons(ctx.phone, "Binada WhatsApp kayitli sakin bulunamadi.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    const announcement = `[DUYURU - ${mc.building.name}]\n\n${text}`;
    let sent = 0;
    for (const p of phones) {
      try {
        await sendText(p, announcement);
        sent++;
      } catch {
        // Skip failed sends
      }
    }

    await sendButtons(ctx.phone, `Duyuru ${sent}/${phones.length} sakine gonderildi.`, [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[sy:duyuru] error:", err);
    await sendText(ctx.phone, "Duyuru gonderilirken hata olustu.");
  }
}
