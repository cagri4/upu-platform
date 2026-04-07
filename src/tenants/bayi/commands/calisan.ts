/**
 * Çalışan Yönetimi — firma sahibi çalışan ekler, yetki verir, talimat gönderir
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError } from "@/platform/whatsapp/error-handler";

// ── Employee groups (which virtual employees they can access) ──────

const EMPLOYEE_GROUPS: Record<string, { label: string; employees: string[]; commands: string[] }> = {
  satis: {
    label: "Satış Ekibi",
    employees: ["satisMuduru", "satisTemsilcisi"],
    commands: ["kampanyaolustur", "kampanyalar", "teklifver", "performans", "segment", "siparisolustur", "siparisler", "bayidurum", "ziyaretnotu", "ziyaretler"],
  },
  finans: {
    label: "Finans Ekibi",
    employees: ["muhasebeci", "tahsildar"],
    commands: ["bakiye", "faturalar", "borcdurum", "ekstre", "odeme", "vadeler", "tahsilat", "hatirlatgonder"],
  },
  depo: {
    label: "Depo & Lojistik",
    employees: ["depocu", "lojistikci"],
    commands: ["stok", "kritikstok", "stokhareketleri", "tedarikciler", "satinalma", "ihtiyac", "teslimatlar", "rota", "kargotakip"],
  },
  urun: {
    label: "Ürün Yönetimi",
    employees: ["urunYoneticisi"],
    commands: ["urunler", "fiyatliste", "yeniurun", "fiyatguncelle"],
  },
  tam: {
    label: "Tam Yetki (Tümü)",
    employees: ["asistan", "satisMuduru", "satisTemsilcisi", "muhasebeci", "tahsildar", "depocu", "lojistikci", "urunYoneticisi"],
    commands: [],
  },
};

// ── /calisanekle — Yeni çalışan ekle ────────────────────────────────

export async function handleCalisanEkle(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  await startSession(ctx.userId, ctx.tenantId, "calisanekle", "name");
  await sendText(ctx.phone, "👤 *Çalışan Ekleme*\n\nÇalışanın adını ve soyadını yazın:");
}

// ── Step handler ────────────────────────────────────────────────────

export async function handleCalisanEkleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text?.trim();
  if (!text) { await sendText(ctx.phone, "Lütfen bir değer yazın."); return; }

  switch (session.current_step) {
    case "name": {
      if (text.length < 2) { await sendText(ctx.phone, "İsim en az 2 karakter olmalı:"); return; }
      await updateSession(ctx.userId, "position", { name: text });
      await sendText(ctx.phone, `Pozisyonu yazın:\n\nÖrnek: Satış Müdürü, Muhasebeci, Depocu`);
      return;
    }

    case "position": {
      await updateSession(ctx.userId, "permission_select", { position: text });
      await sendList(ctx.phone, "🔑 Çalışanın yetki grubunu seçin:", "Yetki Seç", [
        { title: "Yetki Grupları", rows: [
          { id: "calisanekle:perm:satis", title: "💰 Satış Ekibi", description: "Kampanya, sipariş, bayi ziyaret" },
          { id: "calisanekle:perm:finans", title: "💳 Finans Ekibi", description: "Bakiye, fatura, tahsilat" },
          { id: "calisanekle:perm:depo", title: "📦 Depo & Lojistik", description: "Stok, tedarik, teslimat" },
          { id: "calisanekle:perm:urun", title: "🏷 Ürün Yönetimi", description: "Ürün kataloğu, fiyat" },
          { id: "calisanekle:perm:tam", title: "🔓 Tam Yetki", description: "Tüm elemanlar ve komutlar" },
        ]},
      ]);
      return;
    }
  }
}

// ── Callback handler ────────────────────────────────────────────────

export async function handleCalisanEkleCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.replace("calisanekle:", "").split(":");

  if (parts[0] === "perm") {
    const permGroup = parts[1];
    const group = EMPLOYEE_GROUPS[permGroup];
    if (!group) return;

    // Get session data
    const supabase = getServiceClient();
    const { data: sess } = await supabase
      .from("command_sessions").select("data").eq("user_id", ctx.userId).single();

    if (!sess) { await endSession(ctx.userId); return; }
    const d = sess.data as Record<string, unknown>;

    // Create invite code
    const { randomBytes } = await import("crypto");
    const code = randomBytes(3).toString("hex").toUpperCase();

    const permissions = {
      employees: group.employees,
      commands: group.commands,
      group: permGroup,
      groupLabel: group.label,
    };

    // Create auth user + profile + invite code
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: `emp_${Date.now()}_${randomBytes(4).toString("hex")}@placeholder.upudev.nl`,
      email_confirm: true,
      user_metadata: { name: d.name },
    });

    if (authErr || !authUser.user) {
      await endSession(ctx.userId);
      await sendButtons(ctx.phone, "❌ Çalışan oluşturma hatası.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    await supabase.from("profiles").insert({
      id: authUser.user.id,
      tenant_id: ctx.tenantId,
      display_name: d.name as string,
      role: "employee",
      permissions,
      invited_by: ctx.userId,
      metadata: { position: d.position },
    });

    await supabase.from("invite_codes").insert({
      tenant_id: ctx.tenantId,
      user_id: authUser.user.id,
      code,
      status: "pending",
    });

    await supabase.from("subscriptions").insert({
      tenant_id: ctx.tenantId,
      user_id: authUser.user.id,
      plan: "trial",
      status: "active",
    });

    await endSession(ctx.userId);

    await sendButtons(ctx.phone,
      `✅ Çalışan oluşturuldu!\n\n` +
      `👤 ${d.name}\n` +
      `💼 ${d.position}\n` +
      `🔑 Yetki: ${group.label}\n\n` +
      `📋 Kayıt Kodu: *${code}*\n\n` +
      `Bu kodu çalışana gönderin. WhatsApp'tan bota "Kayıt Kodu: ${code}" yazarak sisteme giriş yapacak.`,
      [
        { id: "cmd:calisanyonet", title: "👥 Çalışanlar" },
        { id: "cmd:menu", title: "Ana Menü" },
      ],
    );
    return;
  }

  if (parts[0] === "sil" && parts[1]) {
    const empId = parts[1];
    // Confirm
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

// ── /calisanyonet — Çalışan listesi + yönetim ──────────────────────

export async function handleCalisanYonet(ctx: WaContext): Promise<void> {
  if (ctx.role !== "admin") {
    await sendButtons(ctx.phone, "❌ Bu komut sadece firma sahibi tarafından kullanılabilir.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  try {
    const supabase = getServiceClient();
    const { data: employees } = await supabase
      .from("profiles")
      .select("id, display_name, role, permissions, whatsapp_phone, metadata, created_at")
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
      const perms = (emp.permissions || {}) as Record<string, unknown>;
      const groupLabel = perms.groupLabel || "—";
      const meta = (emp.metadata || {}) as Record<string, unknown>;
      const phone = emp.whatsapp_phone ? "✅" : "⏳ Kayıt bekliyor";
      text += `👤 *${emp.display_name}*\n`;
      text += `   💼 ${meta.position || "—"} | 🔑 ${groupLabel}\n`;
      text += `   📱 ${phone}\n\n`;
    }

    const rows = employees.map(emp => ({
      id: `calisanekle:sil:${emp.id}`,
      title: `🗑 ${(emp.display_name || "?").substring(0, 20)}`,
      description: "Çalışanı sil",
    }));

    await sendButtons(ctx.phone, text, [
      { id: "cmd:calisanekle", title: "➕ Çalışan Ekle" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);

    if (rows.length > 0) {
      await sendList(ctx.phone, "Çalışan silmek için:", "İşlem", [
        { title: "Çalışanlar", rows },
      ]);
    }
  } catch (err) {
    await handleError(ctx, "bayi:calisanyonet", err, "db");
  }
}

// ── /talimat — Çalışana görev gönder ────────────────────────────────

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

// ── Talimat callbacks ───────────────────────────────────────────────

export async function handleTalimatCallback(ctx: WaContext, data: string): Promise<void> {
  if (data.startsWith("talimat_kisi:")) {
    const empId = data.replace("talimat_kisi:", "");
    await startSession(ctx.userId, ctx.tenantId, "talimat", "waiting_message");
    await updateSession(ctx.userId, "waiting_message", { employeeId: empId });
    await sendText(ctx.phone, "✍️ Talimatınızı yazın:\n\nÖrnek: \"Yeni kampanya hazırla — %10 indirim, boya grubu, 15 gün süreli\"");
    return;
  }
}

// ── Talimat step handler ────────────────────────────────────────────

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

  // Send task to employee
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
