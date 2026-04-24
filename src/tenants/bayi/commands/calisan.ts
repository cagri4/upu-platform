/**
 * Çalışan yönetimi — post-pivot (capability-based).
 *
 * Owner runs /calisanekle → UPU generates a 2-hour magic link → owner
 * opens the web form on their phone → types the employee's name +
 * phone, ticks the capability checkboxes, saves → backend creates the
 * auth user + profile with exactly those capabilities and fires a
 * WhatsApp invite to the employee. Old 5-permission-group model
 * removed; owners now grant fine-grained capabilities directly.
 *
 * /calisanyonet — flat list of existing employees; /talimat — send a
 * one-shot task message to an employee. Both are kept in their simpler
 * WA-only form (no web panel) because they don't need the extra
 * capacity a big form gives.
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList, sendUrlButton } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";
import { randomBytes } from "crypto";

// ── /calisanekle — start web invite flow ────────────────────────────

export async function handleCalisanEkle(ctx: WaContext): Promise<void> {
  // Owner-only. Capability gate already enforces EMPLOYEES_MANAGE upstream.
  if (ctx.role !== "admin") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const supabase = getServiceClient();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expiresAt,
  });

  const formUrl = `https://retailai.upudev.nl/tr/bayi-calisan-davet?t=${token}`;
  await sendUrlButton(ctx.phone,
    `👤 *Çalışan Davet*\n\nYeni çalışana tam olarak hangi işlemleri yapabileceğini sen seç. Telefon numarasını yazınca davet mesajı otomatik gidecek.\n\n_Link 2 saat geçerlidir._`,
    "📝 Davet Formunu Aç",
    formUrl,
    { skipNav: true },
  );
}

// Step handler kept for backward-compat — old session flow is dead, but
// if any lingering session exists we just end it.
export async function handleCalisanEkleStep(ctx: WaContext, _session: CommandSession): Promise<void> {
  await endSession(ctx.userId);
  await handleCalisanEkle(ctx);
}

// Callback handler kept for detail/edit/delete flows triggered from
// /calisanyonet list view. Permission-group callbacks are removed.
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

// ── /calisanyonet — çalışan listesi ───────────────────────────────────

export async function handleCalisanYonet(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
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
    await handleError(ctx, "bayi:calisanyonet", err, "db");
  }
}

// ── /talimat — tek seferlik görev mesajı ────────────────────────────

export async function handleTalimat(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: employees } = await supabase
      .from("profiles")
      .select("id, display_name, whatsapp_phone, metadata")
      .eq("invited_by", ctx.userId)
      .eq("role", "employee")
      .not("whatsapp_phone", "is", null);

    if (!employees?.length) {
      await sendButtons(ctx.phone, "Aktif çalışan yok (kayıt tamamlanmış olmalı).", [
        { id: "cmd:calisanekle", title: "➕ Çalışan Ekle" },
        { id: "cmd:menu", title: "Ana Menü" },
      ]);
      return;
    }

    const rows = employees.map(emp => ({
      id: `talimat_kisi:${emp.id}`,
      title: (emp.display_name || "?").substring(0, 24),
      description: ((emp.metadata as Record<string, unknown>)?.position as string) || "",
    }));

    await sendList(ctx.phone, "📋 Talimat göndermek istediğiniz çalışanı seçin:", "Çalışan Seç", [
      { title: "Çalışanlar", rows },
    ]);
  } catch (err) {
    await handleError(ctx, "bayi:talimat", err, "db");
  }
}

export async function handleTalimatCallback(ctx: WaContext, data: string): Promise<void> {
  if (data.startsWith("talimat_kisi:")) {
    const empId = data.replace("talimat_kisi:", "");
    await startSession(ctx.userId, ctx.tenantId, "talimat", "waiting_message");
    await updateSession(ctx.userId, "waiting_message", { employeeId: empId });
    await sendText(ctx.phone, "✍️ Talimatınızı yazın:\n\nÖrnek: \"Yeni kampanya hazırla — %10 indirim, boya grubu, 15 gün süreli\"");
    return;
  }
}

export async function handleTalimatStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) { await sendText(ctx.phone, "Lütfen talimatınızı yazın:"); return; }

  const { employeeId } = session.data as { employeeId: string };
  await endSession(ctx.userId);

  const supabase = getServiceClient();
  const { data: emp } = await supabase
    .from("profiles")
    .select("display_name, whatsapp_phone")
    .eq("id", employeeId)
    .single();

  if (!emp?.whatsapp_phone) {
    await sendButtons(ctx.phone, "❌ Çalışanın telefonu kayıtlı değil.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await sendButtons(emp.whatsapp_phone,
    `📋 *Yeni Talimat*\n\nGönderen: ${ctx.userName}\n\n${text}`,
    [{ id: "cmd:menu", title: "📋 Ana Menü" }],
  );

  await sendButtons(ctx.phone,
    `✅ Talimat gönderildi!\n\n👤 ${emp.display_name}\n📋 ${text.substring(0, 100)}`,
    [
      { id: "cmd:calisanyonet", title: "👥 Çalışanlar" },
      { id: "cmd:menu", title: "Ana Menü" },
    ],
  );
}
