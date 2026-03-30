import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { handleError, logEvent } from "@/platform/whatsapp/error-handler";
import { randomBytes } from "crypto";

export async function handleSozlesmelerim(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: contracts } = await supabase
    .from("contracts")
    .select("id, status, contract_data, signed_at, created_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!contracts || contracts.length === 0) {
    await sendButtons(ctx.phone, "📋 Henüz sözleşmeniz yok.\n\nHemen ilk sözleşmenizi oluşturun!", [
      { id: "cmd:sozlesme", title: "Sözleşme Oluştur" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const rows = contracts.map((c) => {
    const cd = c.contract_data as Record<string, unknown>;
    const ownerName = (cd.owner_name as string) || "İsimsiz";
    const statusLabel = c.status === "signed" ? "✅" : c.status === "pending_signature" ? "⏳" : "📝";
    return {
      id: `szl:view:${c.id}`,
      title: `${statusLabel} ${ownerName}`.substring(0, 24),
      description: new Date(c.created_at).toLocaleDateString("tr-TR"),
    };
  });

  await sendList(ctx.phone, "📋 Sözleşmeleriniz\n\nDetay görmek için seçin.", "Göster", [
    { title: "Sözleşmeler", rows },
  ]);
}

export async function handleWebpanel(ctx: WaContext): Promise<void> {
  const appUrl = "https://estateai.upudev.nl";

  // Generate magic link
  try {
    const supabase = getServiceClient();
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase.from("magic_link_tokens").insert({
      user_id: ctx.userId,
      token,
      expires_at: expiresAt,
    });

    const magicUrl = `${appUrl}/auth/magic?token=${token}`;
    await sendButtons(ctx.phone,
      `🖥 Web Panel\n\nAşağıdaki linke tıklayarak giriş yapın:\n\n${magicUrl}\n\n⏱ 15 dakika geçerli.`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
  } catch {
    await sendButtons(ctx.phone,
      `🖥 Web Panel\n\n${appUrl}/tr/login`,
      [{ id: "cmd:menu", title: "Ana Menü" }],
    );
  }
}

// ── /sozlesme — Contract creation flow ──────────────────────────────

function validateTC(tc: string): boolean {
  const cleaned = tc.replace(/\s/g, "");
  return cleaned.length === 11 && /^\d{11}$/.test(cleaned) && cleaned[0] !== "0";
}

function validatePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (/^0\d{10}$/.test(cleaned)) return cleaned;
  if (/^90\d{10}$/.test(cleaned)) return "0" + cleaned.substring(2);
  if (/^\+90\d{10}$/.test(cleaned)) return "0" + cleaned.substring(3);
  if (/^5\d{9}$/.test(cleaned)) return "0" + cleaned;
  return null;
}

export async function handleSozlesme(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: properties } = await supabase
    .from("emlak_properties")
    .select("id, title, location_district, location_city")
    .eq("user_id", ctx.userId)
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "aktif")
    .order("created_at", { ascending: false })
    .limit(10);

  if (!properties || properties.length === 0) {
    await startSession(ctx.userId, ctx.tenantId, "sozlesme", "property_address");
    await sendText(ctx.phone, "📋 Yetkilendirme sözleşmesi hazırlıyoruz.\n\nPortföyünüzde mülk bulunamadı. Taşınmaz adresini yazın:");
    return;
  }

  await startSession(ctx.userId, ctx.tenantId, "sozlesme", "select_property");

  const rows = properties.map(p => ({
    id: `szl:prop:${p.id}`,
    title: ((p.title || "İsimsiz") as string).substring(0, 24),
    description: (p.location_district || p.location_city || "") as string,
  }));
  rows.push({ id: "szl:prop:manual", title: "Yeni Bilgi Gir", description: "Manuel giriş" });

  await sendList(ctx.phone, "📋 Hangi mülk için sözleşme hazırlayalım?", "Mülk Seç", [
    { title: "Mulkler", rows },
  ]);
}

export async function handleSozlesmeStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text.trim();
  const step = session.current_step;

  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın.");
    return;
  }

  switch (step) {
    case "property_address": {
      if (text.length < 5) {
        await sendText(ctx.phone, "Adres en az 5 karakter olmalı.");
        return;
      }
      await updateSession(ctx.userId, "owner_name", { property_address: text });
      await sendText(ctx.phone, "👤 Mulk sahibinin adi ve soyadi:");
      return;
    }

    case "owner_name": {
      if (text.length < 3) {
        await sendText(ctx.phone, "Ad soyad en az 3 karakter olmalı.");
        return;
      }
      await updateSession(ctx.userId, "owner_tc", { owner_name: text });
      await sendText(ctx.phone, "🆔 Mulk sahibinin TC Kimlik No (11 haneli):");
      return;
    }

    case "owner_tc": {
      const cleaned = text.replace(/\s/g, "");
      if (!validateTC(cleaned)) {
        await sendText(ctx.phone, "❌ Geçerli bir TC Kimlik No girin (11 haneli, 0 ile başlamaz):");
        return;
      }
      await updateSession(ctx.userId, "owner_phone", { owner_tc: cleaned });
      await sendText(ctx.phone, "📱 Mulk sahibinin telefon numarasi:\n\nOrnek: 0532 123 45 67");
      return;
    }

    case "owner_phone": {
      const phone = validatePhone(text);
      if (!phone) {
        await sendText(ctx.phone, "❌ Geçerli bir telefon numarası girin.");
        return;
      }
      await updateSession(ctx.userId, "exclusive", { owner_phone: phone });
      await sendButtons(ctx.phone, "🔒 Münhasır (exclusive) yetkilendirme mi?", [
        { id: "szl:excl:yes", title: "Evet (Münhasır)" },
        { id: "szl:excl:no", title: "Hayır" },
      ]);
      return;
    }

    case "commission": {
      const commission = parseFloat(text.replace(/%/g, "").replace(/,/g, ".").trim());
      if (isNaN(commission) || commission <= 0 || commission > 20) {
        await sendText(ctx.phone, "❌ Geçerli bir oran girin (1-20). Örnek: 2");
        return;
      }
      await updateSession(ctx.userId, "duration", { commission });
      await sendText(ctx.phone, "📅 Sozlesme suresi (ay olarak):\n\nÖrnek: 3\nVarsayilan: 3 ay");
      return;
    }

    case "duration": {
      const duration = parseInt(text.replace(/ay/gi, "").trim(), 10);
      if (isNaN(duration) || duration < 1 || duration > 24) {
        await sendText(ctx.phone, "❌ Geçerli bir süre girin (1-24 ay). Örnek: 3");
        return;
      }
      await updateSession(ctx.userId, "preview", { duration });
      await showSozlesmePreview(ctx);
      return;
    }

    default:
      await sendText(ctx.phone, "Lütfen yukarıdaki butonlardan birini seçin.");
      return;
  }
}

export async function handleSozlesmeCallback(ctx: WaContext, data: string): Promise<void> {
  if (data === "szl:cancel") {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Sözleşme oluşturma iptal edildi.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Property selection
  if (data.startsWith("szl:prop:")) {
    const propId = data.substring("szl:prop:".length).trim();

    if (propId === "manual") {
      await updateSession(ctx.userId, "property_address", {});
      await sendText(ctx.phone, "📍 Taşınmazın tam adresini yazın:");
      return;
    }

    const supabase = getServiceClient();
    const { data: prop } = await supabase
      .from("emlak_properties")
      .select("id, title, location_district, location_city, location_neighborhood, area, rooms, type, listing_type")
      .eq("id", propId)
      .single();

    if (!prop) {
      await endSession(ctx.userId);
      await sendButtons(ctx.phone, "❌ Mülk bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const address = [prop.location_neighborhood, prop.location_district, prop.location_city].filter(Boolean).join(", ");
    await updateSession(ctx.userId, "owner_name", {
      property_id: prop.id,
      property_title: prop.title,
      property_address: address || "Belirtilmemiş",
      property_type: prop.type,
      listing_type: prop.listing_type,
    });

    await sendText(ctx.phone, `✅ Secilen mulk: ${prop.title}\n\n👤 Mulk sahibinin adi ve soyadi:`);
    return;
  }

  // Exclusive selection
  if (data.startsWith("szl:excl:")) {
    const exclusive = data.split(":")[2] === "yes";
    await updateSession(ctx.userId, "commission", { exclusive });
    await sendText(ctx.phone,
      (exclusive ? "✅ Münhasır yetkilendirme seçildi.\n\n" : "✅ Münhasır olmayan yetkilendirme seçildi.\n\n") +
      "💰 Komisyon oranını yazın:\n\nÖrnek: 2 (yüzde olarak)\nVarsayilan: %2",
    );
    return;
  }

  // Confirm
  if (data === "szl:confirm") {
    await createSozlesme(ctx);
    return;
  }

  // View contract detail
  if (data.startsWith("szl:view:")) {
    const contractId = data.substring("szl:view:".length).trim();
    const supabase = getServiceClient();

    const { data: contract } = await supabase
      .from("contracts")
      .select("id, status, contract_data, signed_at, created_at, sign_token")
      .eq("id", contractId)
      .single();

    if (!contract) {
      await sendButtons(ctx.phone, "Sözleşme bulunamadı.", [{ id: "cmd:menu", title: "Ana Menü" }]);
      return;
    }

    const cd = contract.contract_data as Record<string, unknown>;
    const statusLabel = contract.status === "signed" ? "✅ İmzalı" : contract.status === "pending_signature" ? "⏳ İmza bekliyor" : "📝 Taslak";

    let text = `📄 Sözleşme Detayı\n\nDurum: ${statusLabel}\n`;
    text += `🏠 ${cd.property_title || cd.property_address || "-"}\n`;
    text += `👤 ${cd.owner_name}\n📱 ${cd.owner_phone}\n`;
    text += `🔒 Münhasır: ${cd.exclusive ? "Evet" : "Hayır"}\n`;
    text += `💰 Komisyon: %${cd.commission}+KDV\n📅 Sure: ${cd.duration} ay\n`;

    if (contract.status === "pending_signature" && contract.sign_token) {
      const appUrl = "https://estateai.upudev.nl";
      text += `\n🔗 İmza linki:\n${appUrl}/tr/sign/${contract.sign_token}`;
    }

    await sendButtons(ctx.phone, text, [
      { id: "cmd:sozlesmelerim", title: "Geri" },
      { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }
}

async function showSozlesmePreview(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase.from("command_sessions").select("data").eq("user_id", ctx.userId).single();
  if (!sess) { await endSession(ctx.userId); return; }

  const d = sess.data as Record<string, unknown>;
  const exclusive = d.exclusive === true ? "Evet (Münhasır)" : "Hayır";

  let preview = "📄 YETKİLENDİRME SÖZLEŞMESİ ÖNİZLEME\n━━━━━━━━━━━━━━━━━━━━━━\n";
  if (d.property_title) preview += `Ilan: ${d.property_title}\n`;
  preview += `Adres: ${d.property_address || "-"}\n\n`;
  preview += `👤 ${d.owner_name}\n🆔 TC: ${d.owner_tc}\n📱 ${d.owner_phone}\n\n`;
  preview += `🔒 Münhasır: ${exclusive}\n💰 Komisyon: %${d.commission || 2}+KDV\n📅 Sure: ${d.duration || 3} ay`;

  await sendButtons(ctx.phone, preview + "\n\nOnaylıyor musunuz?", [
    { id: "szl:confirm", title: "Onayla" },
    { id: "szl:cancel", title: "İptal" },
  ]);
}

async function createSozlesme(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase.from("command_sessions").select("data").eq("user_id", ctx.userId).single();

  if (!sess) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Hata oluştu. Tekrar deneyin.");
    return;
  }

  const d = sess.data as Record<string, unknown>;
  const signToken = randomBytes(16).toString("hex");

  const { data: contract, error } = await supabase
    .from("contracts")
    .insert({
      tenant_id: ctx.tenantId,
      user_id: ctx.userId,
      property_id: d.property_id || null,
      type: "yetkilendirme",
      status: "pending_signature",
      sign_token: signToken,
      contract_data: {
        property_title: d.property_title || null,
        property_address: d.property_address,
        property_type: d.property_type || null,
        listing_type: d.listing_type || null,
        owner_name: d.owner_name,
        owner_tc: d.owner_tc,
        owner_phone: d.owner_phone,
        exclusive: d.exclusive || false,
        commission: d.commission || 2,
        duration: d.duration || 3,
      },
    })
    .select("id")
    .single();

  await endSession(ctx.userId);

  if (error || !contract) {
    await sendButtons(ctx.phone, "❌ Sözleşme oluşturulurken hata oluştu.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  const appUrl = "https://estateai.upudev.nl";
  const signLink = `${appUrl}/tr/sign/${signToken}`;

  await sendButtons(ctx.phone,
    `✅ Sözleşme hazırlandı!\n\n📋 ${d.property_title || d.property_address}\n👤 ${d.owner_name}\n\n🔗 İmza linki:\n${signLink}\n\nMüşteri linke tıklayarak imza atabilir.`,
    [{ id: "cmd:menu", title: "Ana Menü" }],
  );
}
