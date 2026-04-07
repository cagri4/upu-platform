/**
 * Dealer Onboarding — bayi kayıt olunca bilgilerini toplar
 *
 * Akış: firma adı → yetkili adı → kuruluş yılı → ürün grupları → e-posta → vergi no → şehir/ilçe
 * Sonuç: bayi_dealers kaydı oluşur + profiles.dealer_id bağlanır
 */
import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── Start onboarding ────────────────────────────────────────────────

export async function startDealerOnboarding(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "dealer_onboard", "company_name");
  await sendText(ctx.phone,
    "🏢 *Hoş geldiniz! Sizi tanıyalım.*\n\n" +
    "Firma/şirket adınızı yazın:\n\n" +
    "Örnek: _ABC Ticaret_, _Yılmaz Boya_"
  );
}

// ── Step handler ────────────────────────────────────────────────────

export async function handleDealerOnboardStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const text = ctx.text?.trim();
  const skip = text?.toLowerCase() === "geç";

  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın. (\"geç\" ile atlayın)");
    return;
  }

  switch (session.current_step) {
    case "company_name": {
      if (text.length < 2) {
        await sendText(ctx.phone, "Firma adı en az 2 karakter olmalı:");
        return;
      }
      await updateSession(ctx.userId, "contact_name", { company_name: text });
      await sendText(ctx.phone, "👤 Yetkili kişi adı soyadı:\n\nÖrnek: Ahmet Yılmaz");
      return;
    }

    case "contact_name": {
      if (text.length < 2) {
        await sendText(ctx.phone, "İsim en az 2 karakter olmalı:");
        return;
      }
      await updateSession(ctx.userId, "founded_year", { contact_name: text });
      // Update display name
      const supabase = getServiceClient();
      await supabase.from("profiles").update({ display_name: text }).eq("id", ctx.userId);

      await sendList(ctx.phone, "📅 Kuruluş yılı:", "Yıl Seç", [
        { title: "Kuruluş Yılı", rows: [
          { id: "donboard:year:2020", title: "2020 ve sonrası" },
          { id: "donboard:year:2015", title: "2015-2019" },
          { id: "donboard:year:2010", title: "2010-2014" },
          { id: "donboard:year:2005", title: "2005-2009" },
          { id: "donboard:year:2000", title: "2000-2004" },
          { id: "donboard:year:1990", title: "1990-1999" },
          { id: "donboard:year:old", title: "1990 öncesi" },
          { id: "donboard:year:skip", title: "Belirtme" },
        ]},
      ]);
      return;
    }

    case "email": {
      const email = skip ? null : text;
      if (email && !email.includes("@")) {
        await sendText(ctx.phone, "Geçerli bir e-posta adresi yazın veya \"geç\" yazın:");
        return;
      }
      await updateSession(ctx.userId, "tax_no", { email });
      await sendText(ctx.phone, "🧾 Vergi numarası:\n\n(\"geç\" ile atlayın)");
      return;
    }

    case "tax_no": {
      const taxNo = skip ? null : text;
      await updateSession(ctx.userId, "city", { tax_no: taxNo });
      await sendText(ctx.phone, "📍 Şehir:\n\nÖrnek: İstanbul\n\n(\"geç\" ile atlayın)");
      return;
    }

    case "city": {
      const city = skip ? null : text;
      await updateSession(ctx.userId, "district", { city });
      await sendText(ctx.phone, "📍 İlçe:\n\nÖrnek: Kadıköy\n\n(\"geç\" ile atlayın)");
      return;
    }

    case "district": {
      const district = skip ? null : text;
      await updateSession(ctx.userId, "finalize", { district });
      await finalizeDealerOnboarding(ctx);
      return;
    }
  }
}

// ── Callback handler ────────────────────────────────────────────────

export async function handleDealerOnboardCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.replace("donboard:", "").split(":");

  if (parts[0] === "year") {
    const year = parts[1] === "skip" ? null : parts[1];
    await updateSession(ctx.userId, "product_groups", { founded_year: year });
    await sendList(ctx.phone, "📦 İlgilendiğiniz ürün grupları:", "Ürün Grubu", [
      { title: "Ürün Grupları", rows: [
        { id: "donboard:products:boya", title: "Boya & Vernik" },
        { id: "donboard:products:insaat", title: "İnşaat Malzemesi" },
        { id: "donboard:products:elektrik", title: "Elektrik & Aydınlatma" },
        { id: "donboard:products:tesisat", title: "Tesisat & Sıhhi" },
        { id: "donboard:products:hirdavat", title: "Hırdavat" },
        { id: "donboard:products:klima", title: "Klima & Isıtma" },
        { id: "donboard:products:mobilya", title: "Mobilya" },
        { id: "donboard:products:gida", title: "Gıda" },
        { id: "donboard:products:diger", title: "Diğer" },
        { id: "donboard:products:hepsi", title: "Tümü" },
      ]},
    ]);
    return;
  }

  if (parts[0] === "products") {
    const productGroup = parts[1];
    const labels: Record<string, string> = {
      boya: "Boya & Vernik", insaat: "İnşaat Malzemesi", elektrik: "Elektrik & Aydınlatma",
      tesisat: "Tesisat & Sıhhi", hirdavat: "Hırdavat", klima: "Klima & Isıtma",
      mobilya: "Mobilya", gida: "Gıda", diger: "Diğer", hepsi: "Tümü",
    };
    await updateSession(ctx.userId, "email", { product_group: labels[productGroup] || productGroup });
    await sendText(ctx.phone, "📧 E-posta adresiniz:\n\nÖrnek: info@firmam.com\n\n(\"geç\" ile atlayın)");
    return;
  }
}

// ── Finalize — create dealer record ─────────────────────────────────

async function finalizeDealerOnboarding(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();

  const { data: sess } = await supabase
    .from("command_sessions").select("data").eq("user_id", ctx.userId).single();

  if (!sess) {
    await endSession(ctx.userId);
    await sendText(ctx.phone, "Bir hata oluştu. Lütfen tekrar deneyin.");
    return;
  }

  const d = sess.data as Record<string, unknown>;

  // Get owner (invited_by)
  const { data: profile } = await supabase
    .from("profiles")
    .select("invited_by, tenant_id")
    .eq("id", ctx.userId)
    .single();

  const ownerId = profile?.invited_by;

  // Create bayi_dealers record
  const { data: dealer, error } = await supabase
    .from("bayi_dealers")
    .insert({
      tenant_id: ctx.tenantId,
      user_id: ownerId || ctx.userId,
      company_name: d.company_name as string,
      name: d.company_name as string,
      contact_name: d.contact_name as string,
      phone: ctx.phone,
      email: (d.email as string) || `dealer_${ctx.phone}@placeholder.upudev.nl`,
      tax_no: d.tax_no || null,
      city: d.city || null,
      district: d.district || null,
      founded_year: d.founded_year || null,
      product_group: d.product_group || null,
      status: "active",
      balance: 0,
    })
    .select("id")
    .single();

  if (error || !dealer) {
    await endSession(ctx.userId);
    await sendButtons(ctx.phone, "❌ Kayıt hatası. Lütfen tekrar deneyin.", [{ id: "cmd:menu", title: "Ana Menü" }]);
    return;
  }

  // Link dealer_id to profile
  await supabase.from("profiles")
    .update({ dealer_id: dealer.id, email: (d.email as string) || null })
    .eq("id", ctx.userId);

  await endSession(ctx.userId);

  // Update profile email if provided
  if (d.email) {
    await supabase.from("profiles").update({ email: d.email as string }).eq("id", ctx.userId);
  }

  let summary = `✅ *Kayıt tamamlandı!*\n\n`;
  summary += `🏢 ${d.company_name}\n`;
  summary += `👤 ${d.contact_name}\n`;
  if (d.founded_year) summary += `📅 Kuruluş: ${d.founded_year}\n`;
  if (d.product_group) summary += `📦 Ürün grubu: ${d.product_group}\n`;
  if (d.city || d.district) summary += `📍 ${[d.district, d.city].filter(Boolean).join(", ")}\n`;
  if (d.email) summary += `📧 ${d.email}\n`;
  if (d.tax_no) summary += `🧾 VKN: ${d.tax_no}\n`;
  summary += `\n💡 *Şunları deneyin:*\n`;
  summary += `• "siparisver" — sipariş oluşturun\n`;
  summary += `• "bakiyem" — bakiye durumunuz\n`;
  summary += `• "fiyatlar" — güncel fiyat listesi`;

  await sendButtons(ctx.phone, summary, [
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);

  // Notify firm owner
  if (ownerId) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("whatsapp_phone")
      .eq("id", ownerId)
      .single();

    if (owner?.whatsapp_phone) {
      await sendButtons(owner.whatsapp_phone,
        `🆕 *Yeni Bayi Kaydı!*\n\n🏢 ${d.company_name}\n👤 ${d.contact_name}\n📱 ${ctx.phone}` +
        (d.city ? `\n📍 ${[d.district, d.city].filter(Boolean).join(", ")}` : ""),
        [
          { id: "cmd:bayidurum", title: "📋 Bayi Durumu" },
          { id: "cmd:menu", title: "Ana Menü" },
        ],
      );
    }
  }
}
