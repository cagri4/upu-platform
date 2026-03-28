/**
 * /binakodu — Yonetici bina erisiim kodunu goruntuleme/olusturma
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getStaffContext, generateAccessCode } from "./helpers";

export async function handleBinaKodu(ctx: WaContext): Promise<void> {
  try {
    const mc = await getStaffContext(ctx.userId);
    if (!mc) {
      await sendButtons(ctx.phone, "Bir binaya baglanmaniz gerekiyor. Yoneticinize basvurun.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    let code = mc.building.access_code;

    if (!code) {
      code = generateAccessCode();
      const supabase = getServiceClient();
      await supabase
        .from("sy_buildings")
        .update({ access_code: code })
        .eq("id", mc.building.id);
    }

    await sendButtons(
      ctx.phone,
      `Bina Kodu: ${code}\n\nSakinleriniz bu kodu WhatsApp'tan gondererek kayit olabilir.\n\nOrnek: kayit ${code}`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[sy:binakodu] error:", err);
    await sendText(ctx.phone, "Bina kodu alinirken hata olustu.");
  }
}
