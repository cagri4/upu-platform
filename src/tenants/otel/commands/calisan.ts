/**
 * Otel — çalışan yönetimi (capability-based, bayi pattern klonu).
 *
 * Owner runs /calisanekle → 2h magic_link_tokens → owner opens the form
 * on phone, picks role-preset + capabilities + (optional) hotel_id, saves
 * → backend creates auth user + profile (role=employee, capabilities) +
 * hotel_employees row (per-hotel scope) + invite_codes pending → WA invite
 * to employee.
 *
 * /calisanyonet — flat list. Detail/sil callbacks reuse calisanekle: prefix.
 * /duyuru — tek-yön broadcast tüm çalışanlara (text/buton).
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";
import { getTenantByKey } from "@/tenants/config";
import { randomBytes } from "crypto";

// ── /calisanekle — start web invite flow ───────────────────────────────

export async function handleCalisanEkle(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece otel sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const supabase = getServiceClient();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expiresAt,
    purpose: "otel-calisan-davet",
  });

  const tenant = getTenantByKey("otel");
  const slug = tenant?.slug || "hotelai";
  const formUrl = `https://${slug}.upudev.nl/tr/otel-calisan-davet?t=${token}`;
  await sendUrlButton(ctx.phone,
    `👤 *Çalışan Davet*\n\nYeni çalışana hangi işlemleri yapabileceğini sen seç. Telefonunu yazınca davet mesajı otomatik gidecek.\n\n_Link 2 saat geçerlidir._`,
    "📝 Davet Formunu Aç",
    formUrl,
    { skipNav: true },
  );
}

export async function handleCalisanEkleStep(ctx: WaContext, _session: CommandSession): Promise<void> {
  await endSession(ctx.userId);
  await handleCalisanEkle(ctx);
}

// ── /calisanyonet — çalışan listesi ────────────────────────────────────

export async function handleCalisanYonet(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece otel sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: employees } = await supabase
      .from("profiles")
      .select("id, display_name, role, capabilities, whatsapp_phone, metadata, created_at")
      .eq("invited_by", ctx.userId)
      .eq("role", "employee")
      .order("created_at", { ascending: false });

    if (!employees?.length) {
      await sendButtons(ctx.phone, "Henüz çalışan eklenmemiş.", [
        { id: "cmd:calisanekle", title: "➕ Çalışan Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    let text = `👥 *Çalışanlarım* (${employees.length})\n\n`;
    for (const emp of employees) {
      const caps = (emp.capabilities as string[] | null) || [];
      const meta = (emp.metadata || {}) as Record<string, unknown>;
      const phone = emp.whatsapp_phone ? "✅" : "⏳ Kayıt bekliyor";
      text += `👤 *${emp.display_name}*\n`;
      text += `   💼 ${meta.position || "—"} | 🔑 ${caps.length} yetki\n`;
      text += `   📱 ${phone}\n\n`;
    }

    const rows = employees.map(emp => ({
      id: `calisanekle:detay:${emp.id}`,
      title: `${(emp.display_name || "?").substring(0, 24)}`,
      description: ((emp.metadata as Record<string, unknown>)?.position as string || "").substring(0, 72),
    }));

    await sendButtons(ctx.phone, text, [
      { id: "cmd:calisanekle", title: "➕ Çalışan Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);

    if (rows.length > 0) {
      await sendList(ctx.phone, "Detay için çalışan seçin:", "Çalışan Seç", [
        { title: "Çalışanlar", rows },
      ]);
    }
  } catch (err) {
    await handleError(ctx, "otel:calisanyonet", err, "db");
  }
}

// Detail / sil callbacks (calisanekle: prefix)
export async function handleCalisanEkleCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.replace("calisanekle:", "").split(":");

  if (parts[0] === "detay" && parts[1]) {
    const empId = parts[1];
    const supabase = getServiceClient();
    const { data: emp } = await supabase
      .from("profiles")
      .select("id, display_name, role, capabilities, whatsapp_phone, metadata, created_at")
      .eq("id", empId)
      .single();

    if (!emp) {
      await sendButtons(ctx.phone, "Çalışan bulunamadı.", [{ id: "cmd:calisanyonet", title: "👥 Çalışanlar" }]);
      return;
    }

    const caps = (emp.capabilities as string[] | null) || [];
    const meta = (emp.metadata || {}) as Record<string, unknown>;
    const phone = emp.whatsapp_phone || "Kayıt bekliyor";
    const date = new Date(emp.created_at).toLocaleDateString("tr-TR");

    let text = `👤 *${emp.display_name}*\n\n`;
    text += `💼 Pozisyon: ${meta.position || "—"}\n`;
    text += `📱 Telefon: ${phone}\n`;
    text += `📅 Eklenme: ${date}\n`;
    text += `🔑 Yetki: ${caps.length} kalem\n`;

    await sendButtons(ctx.phone, text, [
      { id: `calisanekle:sil:${empId}`, title: "🗑 Sil" },
      { id: "cmd:calisanyonet", title: "🔙 Çalışanlar" },
    ]);
    return;
  }

  if (parts[0] === "sil" && parts[1]) {
    const empId = parts[1];
    const supabase = getServiceClient();
    const { data: emp } = await supabase.from("profiles").select("display_name").eq("id", empId).single();

    if (data.startsWith("calisanekle:sil_ok:")) {
      // Cascade: hotel_employees rows are removed by ON DELETE CASCADE on profile_id
      await supabase.from("profiles").delete().eq("id", empId).eq("invited_by", ctx.userId);
      await sendButtons(ctx.phone, `✅ ${emp?.display_name || "Çalışan"} silindi.`, [
        { id: "cmd:calisanyonet", title: "👥 Çalışanlar" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
    } else {
      await sendButtons(ctx.phone, `🗑 "${emp?.display_name}" çalışanını silmek istediğinize emin misiniz?`, [
        { id: `calisanekle:sil_ok:${empId}`, title: "Evet, Sil" },
        { id: "cmd:calisanyonet", title: "İptal" },
      ]);
    }
    return;
  }
}

// ── /duyuru — tek-yön broadcast (manager veya owner) ───────────────────

export async function handleDuyuru(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "duyuru", "waiting_message");
  await sendText(ctx.phone, "📣 Tüm çalışanlara gönderilecek duyuruyu yazın:\n\nÖrnek: \"Yarın 09:00 — kat sorumluları toplantı\".\n\n_İptal için: iptal_");
}

export async function handleDuyuruStep(ctx: WaContext, _session: CommandSession): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) { await sendText(ctx.phone, "Lütfen duyuru metnini yazın:"); return; }
  if (text.toLowerCase() === "iptal" || text.toLowerCase() === "vazgeç") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "İptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await endSession(ctx.userId);

  try {
    const supabase = getServiceClient();
    const { data: employees } = await supabase
      .from("profiles")
      .select("display_name, whatsapp_phone")
      .eq("invited_by", ctx.userId)
      .eq("role", "employee")
      .not("whatsapp_phone", "is", null);

    if (!employees?.length) {
      await sendButtons(ctx.phone, "Aktif çalışan yok.", [{ id: "cmd:calisanekle", title: "➕ Çalışan Ekle" }, { id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const senderLabel = ctx.userName || "Yöneticiniz";
    let sent = 0;
    for (const emp of employees) {
      try {
        await sendButtons(emp.whatsapp_phone!,
          `📣 *Duyuru*\n\nGönderen: ${senderLabel}\n\n${text}`,
          [{ id: "cmd:menu", title: "📋 Ana Menü" }],
        );
        sent++;
      } catch { /* ignore individual failures */ }
    }

    await sendButtons(ctx.phone,
      `✅ Duyuru gönderildi.\n\n👥 Alıcı: ${sent}/${employees.length}\n📋 Mesaj: ${text.substring(0, 80)}${text.length > 80 ? "..." : ""}`,
      [
        { id: "cmd:calisanyonet", title: "👥 Çalışanlar" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
  } catch (err) {
    await handleError(ctx, "otel:duyuru", err, "db");
  }
}
