/**
 * /kayit — Sakin kayit islemi (bina erisiim kodu ile)
 *
 * Flow: User sends 6-char building access code → system creates profile link
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendText, sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

const TENANT_ID = "c12010c7-7b13-44d5-bdc7-fc7c2c1ac82e";

export async function handleKayit(ctx: WaContext): Promise<void> {
  try {
    const code = ctx.text.replace(/^\/?\s*(kayit|start)\s*/i, "").trim().toUpperCase();

    if (!code || code.length !== 6) {
      await sendText(
        ctx.phone,
        "Kayit olmak icin yoneticinizden aldiginiz 6 haneli bina kodunu gonderin.\n\nOrnek: kayit ABC123",
      );
      return;
    }

    const supabase = getServiceClient();

    // Find building by access code
    const { data: building } = await supabase
      .from("sy_buildings")
      .select("id, name")
      .eq("access_code", code)
      .eq("tenant_id", TENANT_ID)
      .maybeSingle();

    if (!building) {
      await sendText(ctx.phone, "Gecersiz bina kodu. Lutfen yoneticinizden dogrulayin.");
      return;
    }

    // Check if already linked to this building
    const { data: existingLink } = await supabase
      .from("sy_user_residents")
      .select("id")
      .eq("user_id", ctx.userId)
      .eq("building_id", building.id)
      .maybeSingle();

    if (existingLink) {
      await sendButtons(ctx.phone, "Bu binaya zaten kayitlisiniz. \"menu\" yazarak komutlari gorebilirsiniz.", [
        { id: "cmd:menu", title: "Ana Menu" },
      ]);
      return;
    }

    // Find a resident record matching phone
    const { data: resident } = await supabase
      .from("sy_residents")
      .select("id, unit_id")
      .eq("building_id", building.id)
      .eq("phone", ctx.phone)
      .eq("is_active", true)
      .maybeSingle();

    if (!resident) {
      await sendText(
        ctx.phone,
        `Bina kodunuz dogru (${building.name}), ancak bu telefon numarasi sakin listesinde bulunamadi.\n\nYoneticinizin sizi sisteme eklemesini isteyin.`,
      );
      return;
    }

    // Create link
    await supabase.from("sy_user_residents").insert({
      user_id: ctx.userId,
      resident_id: resident.id,
      building_id: building.id,
    });

    await sendButtons(
      ctx.phone,
      `Hos geldiniz${ctx.userName ? ", " + ctx.userName : ""}!\n\n${building.name} binasina kaydiniz tamamlandi.\n\nKullanabileceginiz komutlar:\nborcum -- Borc durumunu sorgula\nariza -- Ariza bildir\nmenu -- Tum komutlar`,
      [{ id: "cmd:menu", title: "Ana Menu" }],
    );
  } catch (err) {
    console.error("[sy:kayit] error:", err);
    await sendText(ctx.phone, "Kayit isleminde hata olustu. Tekrar deneyin.");
  }
}
