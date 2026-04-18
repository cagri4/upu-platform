import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession, getSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── Constants ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  daire: "Daire", villa: "Villa", mustakil: "Müstakil", rezidans: "Rezidans",
  arsa: "Arsa", isyeri: "İşyeri", dukkan: "Dükkan", buro_ofis: "Büro/Ofis",
};

// ── Menu: choose add method ─────────────────────────────────────────────

export async function handleMulkEkleMenu(ctx: WaContext): Promise<void> {
  await sendButtons(ctx.phone,
    "🏠 *Mülk Ekle*\n\nNasıl eklemek istersiniz?",
    [
      { id: "mulkekle_method:link", title: "🔗 Sahibinden linki" },
      { id: "mulkekle_method:detayli", title: "📝 Manuel ekle" },
    ],
  );
}

// ── Start detaylı flow ─────────────────────────────────────────────────

export async function handleMulkEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "mulkekle", "title");
  await sendText(ctx.phone,
    "🏠 *Detaylı Mülk Ekleme*\n\n" +
    "📋 Aşama 1/3 — Temel Bilgiler\n\n" +
    "İlan başlığını yazın:\n\nÖrnek: \"Yalıkavak Kiralık 2+1 Daire\""
  );
}

// ── Step handler (text inputs only) ─────────────────────────────────────

export async function handleMulkEkleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const step = session.current_step;
  const text = ctx.text;
  const skip = text?.toLowerCase() === "geç";

  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın. (\"geç\" ile atlayın)");
    return;
  }

  switch (step) {
    // ── AŞAMA 1: Temel Bilgiler ──

    case "title": {
      if (text.length < 3) {
        await sendText(ctx.phone, "Başlık en az 3 karakter olmalı:");
        return;
      }
      await updateSession(ctx.userId, "price", { title: text });
      await sendText(ctx.phone, "💰 Fiyatı yazın:\n\nÖrnek: 4.5M, 25 bin, 750.000");
      return;
    }

    case "price": {
      const price = parsePrice(text);
      if (!price) {
        await sendText(ctx.phone, "Geçerli fiyat yazın. Örnek: 4.5M, 25 bin");
        return;
      }
      await updateSession(ctx.userId, "m2", { price });
      await sendText(ctx.phone, "📐 Brüt metrekare yazın:\n\nÖrnek: 120");
      return;
    }

    case "m2": {
      const m2 = parseInt(text.replace(/[^\d]/g, ""), 10);
      if (!m2 || m2 < 1) {
        await sendText(ctx.phone, "Geçerli metrekare yazın:");
        return;
      }
      // Skip net_area — go straight to rooms (fast flow)
      await updateSession(ctx.userId, "rooms", { m2 });
      await sendList(ctx.phone, "🛏 Oda sayısını seçin:", "Oda Sayısı", [
        { title: "Oda Seçenekleri", rows: [
          { id: "mulkekle:rooms:1+0", title: "1+0 (Stüdyo)" },
          { id: "mulkekle:rooms:1+1", title: "1+1" },
          { id: "mulkekle:rooms:2+1", title: "2+1" },
          { id: "mulkekle:rooms:3+1", title: "3+1" },
          { id: "mulkekle:rooms:3+2", title: "3+2" },
          { id: "mulkekle:rooms:4+1", title: "4+1" },
          { id: "mulkekle:rooms:4+2", title: "4+2" },
          { id: "mulkekle:rooms:5+1", title: "5+1" },
          { id: "mulkekle:rooms:6+", title: "6+" },
        ]},
      ]);
      return;
    }

    case "city": {
      const city = skip ? null : text;
      await updateSession(ctx.userId, "district", { city });
      await sendText(ctx.phone, "📍 İlçe yazın:\n\nÖrnek: Bodrum\n\n(\"geç\" ile atlayın)");
      return;
    }

    case "district": {
      const district = skip ? null : text;
      await updateSession(ctx.userId, "neighborhood", { district });
      await sendText(ctx.phone, "📍 Mahalle yazın:\n\nÖrnek: Yalıkavak, Bitez\n\n(\"geç\" ile atlayın)");
      return;
    }

    case "neighborhood": {
      const neighborhood = skip ? null : text;
      await updateSession(ctx.userId, "net_area", { neighborhood });
      await sendText(ctx.phone, "📐 Net metrekare yazın:\n\nÖrnek: 95\n\n(\"geç\" ile atlayın)");
      return;
    }

    case "net_area": {
      const netArea = skip ? null : parseInt(text.replace(/[^\d]/g, ""), 10) || null;
      await updateSession(ctx.userId, "floor_select", { net_area: netArea });
      // Continue to floor LIST (callback-based chain: floor → totalfloors → buildingage → heating → ... → finalize)
      await handleMulkEkleCallback(ctx, "mulkekle:phase:2");
      return;
    }

    // description/features now handled via callback-based list selection
    // old text steps removed — see intfeat/extfeat/viewfeat callbacks + desc_choice

    // transport_input now handled via callback-based list selection (see transport handler)

    case "description_text": {
      await updateSession(ctx.userId, "finalize_ready", { description: text });
      await finalizeProperty(ctx);
      return;
    }

    default:
      await sendText(ctx.phone, "Lütfen yukarıdaki seçeneklerden birini kullanın.");
      return;
  }
}

// ── Callback handler (list/button selections) ───────────────────────────

export async function handleMulkEkleCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.split(":");
  if (parts.length < 3) return;
  const [, field, value] = parts;

  // ═══ AŞAMA 1 ═══

  if (field === "rooms") {
    await updateSession(ctx.userId, "listing_type", { rooms: value });
    await sendButtons(ctx.phone, "📋 İlan türünü seçin:", [
      { id: "mulkekle:lt:satilik", title: "🏷 Satılık" },
      { id: "mulkekle:lt:kiralik", title: "🔑 Kiralık" },
    ]);
    return;
  }

  if (field === "lt") {
    // Detect type from title
    const { data: sess } = await getServiceClient().from("command_sessions").select("data").eq("user_id", ctx.userId).single();
    const title = ((sess?.data as Record<string, unknown>)?.title as string || "").toLowerCase();
    let detectedType = "daire";
    if (title.includes("villa")) detectedType = "villa";
    else if (title.includes("müstakil") || title.includes("mustakil")) detectedType = "mustakil";
    else if (title.includes("arsa")) detectedType = "arsa";
    else if (title.includes("rezidans")) detectedType = "rezidans";
    else if (title.includes("yazlık") || title.includes("yazlik")) detectedType = "yazlik";
    else if (title.includes("dükkan") || title.includes("dukkan")) detectedType = "dukkan";
    else if (title.includes("ofis") || title.includes("büro")) detectedType = "buro_ofis";

    await updateSession(ctx.userId, "city", { listing_type: value, type: detectedType });
    await sendText(ctx.phone, "📍 Şehir yazın:\n\nÖrnek: Muğla");
    return;
  }

  if (field === "type") {
    // Legacy callback — still works if triggered externally
    await updateSession(ctx.userId, "city", { type: value });
    await sendText(ctx.phone, "📍 Şehir yazın:\n\nÖrnek: Muğla");
    return;
  }

  // ═══ Phase Navigation ═══

  if (field === "phase") {
    if (value === "2") {
      // Aşama 2 — Kat seçimi (sahibinden label uyumlu)
      await updateSession(ctx.userId, "floor_select", {});
      await sendList(ctx.phone,
        "🏢 *Aşama 2/3 — Bina Bilgileri*\n\nKat seçin:",
        "Kat", [{ title: "Kat", rows: [
          { id: "mulkekle:floor:Bodrum", title: "Bodrum" },
          { id: "mulkekle:floor:Zemin", title: "Zemin" },
          { id: "mulkekle:floor:1", title: "1" },
          { id: "mulkekle:floor:2", title: "2" },
          { id: "mulkekle:floor:3", title: "3" },
          { id: "mulkekle:floor:4", title: "4" },
          { id: "mulkekle:floor:5", title: "5" },
          { id: "mulkekle:floor:6-10", title: "6-10" },
          { id: "mulkekle:floor:11+", title: "11+" },
          { id: "mulkekle:floor:yok", title: "Belirtme" },
        ]}],
      );
      return;
    }
    if (value === "3") {
      // Aşama 3 — Banyo (sahibinden label uyumlu: 1, 2, 3, 4+)
      await updateSession(ctx.userId, "bathroom_select", {});
      await sendList(ctx.phone,
        "🚿 *Aşama 3/3 — Detaylar*\n\nBanyo sayısı:",
        "Banyo", [{ title: "Banyo Sayısı", rows: [
          { id: "mulkekle:bathroom:1", title: "1" },
          { id: "mulkekle:bathroom:2", title: "2" },
          { id: "mulkekle:bathroom:3", title: "3" },
          { id: "mulkekle:bathroom:4+", title: "4+" },
          { id: "mulkekle:bathroom:yok", title: "Belirtme" },
        ]}],
      );
      return;
    }
    return;
  }

  // ═══ AŞAMA 2 ═══

  if (field === "floor") {
    // Store the sahibinden-compatible label as text (not int).
    // Sahibinden options: Bodrum, Zemin, 1..5, 6-10, 11+
    const floor = value === "yok" ? null : value === "Bodrum" ? "Bodrum Kat" : value === "Zemin" ? "Zemin Kat" : value;
    await updateSession(ctx.userId, "totalfloors_select", { floor });
    await sendList(ctx.phone, "🏢 Toplam kat sayısı:", "Toplam Kat", [
      { title: "Toplam Kat", rows: [
        { id: "mulkekle:totalfloors:1", title: "1" },
        { id: "mulkekle:totalfloors:2", title: "2" },
        { id: "mulkekle:totalfloors:3", title: "3" },
        { id: "mulkekle:totalfloors:4", title: "4" },
        { id: "mulkekle:totalfloors:5", title: "5" },
        { id: "mulkekle:totalfloors:6-10", title: "6-10" },
        { id: "mulkekle:totalfloors:11-15", title: "11-15" },
        { id: "mulkekle:totalfloors:16-20", title: "16-20" },
        { id: "mulkekle:totalfloors:21+", title: "21+" },
        { id: "mulkekle:totalfloors:yok", title: "Belirtme" },
      ]},
    ]);
    return;
  }

  if (field === "totalfloors") {
    // Store as text label matching sahibinden options
    const tf = value === "yok" ? null : value;
    await updateSession(ctx.userId, "buildingage_select", { total_floors: tf });
    await sendList(ctx.phone, "🏗 Bina yaşı:", "Bina Yaşı", [
      { title: "Bina Yaşı", rows: [
        { id: "mulkekle:buildingage:0", title: "0 (Yeni)" },
        { id: "mulkekle:buildingage:1", title: "1" },
        { id: "mulkekle:buildingage:2", title: "2" },
        { id: "mulkekle:buildingage:3", title: "3" },
        { id: "mulkekle:buildingage:4", title: "4" },
        { id: "mulkekle:buildingage:5-10", title: "5-10" },
        { id: "mulkekle:buildingage:11-15", title: "11-15" },
        { id: "mulkekle:buildingage:16-20", title: "16-20" },
        { id: "mulkekle:buildingage:21+", title: "21+" },
        { id: "mulkekle:buildingage:yok", title: "Belirtme" },
      ]},
    ]);
    return;
  }

  if (field === "buildingage") {
    // Store as sahibinden's text label, e.g. "0 (Yeni)" or "5-10"
    const age = value === "yok" ? null : value === "0" ? "0 (Yeni)" : value;
    await updateSession(ctx.userId, "heating_select", { building_age: age });
    await sendList(ctx.phone, "🔥 Isınma tipi:", "Isınma", [
      { title: "Isınma", rows: [
        { id: "mulkekle:heating:kombi", title: "Kombi (Doğalgaz)" },
        { id: "mulkekle:heating:merkezi", title: "Merkezi" },
        { id: "mulkekle:heating:yerden", title: "Yerden Isıtma" },
        { id: "mulkekle:heating:klima", title: "Klima" },
        { id: "mulkekle:heating:soba", title: "Soba" },
        { id: "mulkekle:heating:yok_isinma", title: "Yok" },
        { id: "mulkekle:heating:belirtme", title: "Belirtme" },
      ]},
    ]);
    return;
  }

  if (field === "heating") {
    const heatingLabels: Record<string, string> = {
      kombi: "Kombi (Doğalgaz)", merkezi: "Merkezi", yerden: "Yerden Isıtma",
      klima: "Klima", soba: "Soba", yok_isinma: "Yok",
    };
    const heating = value === "belirtme" ? null : (heatingLabels[value] || value);
    await updateSession(ctx.userId, "parking_select", { heating });
    await sendList(ctx.phone, "🅿️ Otopark:", "Otopark", [
      { title: "Otopark", rows: [
        { id: "mulkekle:parking:acik", title: "Açık Otopark" },
        { id: "mulkekle:parking:kapali", title: "Kapalı Otopark" },
        { id: "mulkekle:parking:acik_kapali", title: "Açık & Kapalı" },
        { id: "mulkekle:parking:yok", title: "Yok" },
        { id: "mulkekle:parking:belirtme", title: "Belirtme" },
      ]},
    ]);
    return;
  }

  if (field === "parking") {
    const parkingLabels: Record<string, string> = {
      acik: "Açık Otopark", kapali: "Kapalı Otopark",
      acik_kapali: "Açık & Kapalı", yok: "Yok",
    };
    const parking = value === "belirtme" ? null : (parkingLabels[value] || value);
    await updateSession(ctx.userId, "facade_select", { parking });
    // Sahibinden's cephe field accepts ONLY 4 cardinal directions
    // (see emlak-danismani-ai-asistanı/.../publishing.ts SAHIBINDEN_FIELDS).
    // Intercardinal options were removed because the Chrome extension can't
    // match a checkbox label that doesn't exist on the sahibinden form.
    await sendList(ctx.phone, "🧭 Cephe yönü:", "Cephe", [
      { title: "Cephe Yönü", rows: [
        { id: "mulkekle:facade:kuzey", title: "Kuzey" },
        { id: "mulkekle:facade:guney", title: "Güney" },
        { id: "mulkekle:facade:dogu", title: "Doğu" },
        { id: "mulkekle:facade:bati", title: "Batı" },
        { id: "mulkekle:facade:yok", title: "Belirtme" },
      ]},
    ]);
    return;
  }

  if (field === "facade") {
    const facadeLabels: Record<string, string> = {
      kuzey: "Kuzey", guney: "Güney", dogu: "Doğu", bati: "Batı",
    };
    const facade = value === "yok" ? null : facadeLabels[value] || value;
    await updateSession(ctx.userId, "deed_select", { facade });
    await sendList(ctx.phone, "📜 Tapu durumu:", "Tapu", [
      { title: "Tapu Durumu", rows: [
        { id: "mulkekle:deed:kat_mulkiyeti", title: "Kat Mülkiyeti" },
        { id: "mulkekle:deed:kat_irtifaki", title: "Kat İrtifakı" },
        { id: "mulkekle:deed:arsa_tapusu", title: "Arsa Tapusu" },
        { id: "mulkekle:deed:hisseli", title: "Hisseli Tapu" },
        { id: "mulkekle:deed:kooperatif", title: "Kooperatif" },
        { id: "mulkekle:deed:yok", title: "Belirtme" },
      ]},
    ]);
    return;
  }

  if (field === "deed") {
    // Sahibinden labels: Kat Mülkiyetli, Kat İrtifaklı, Hisseli Tapu, Müstakil Tapulu
    const deedLabels: Record<string, string> = {
      kat_mulkiyeti: "Kat Mülkiyetli",
      kat_irtifaki: "Kat İrtifaklı",
      hisseli: "Hisseli Tapu",
      mustakil_tapulu: "Müstakil Tapulu",
    };
    const deed = value === "yok" ? null : deedLabels[value] || value;
    await updateSession(ctx.userId, "housing_select", { deed_type: deed });
    // Sahibinden konut_tipi: Ara Kat, En Üst Kat, Dubleks, Bahçe Dubleksi, Çatı Dubleksi, Tripleks
    await sendList(ctx.phone, "🏗 Konut Tipi:", "Konut Tipi", [
      { title: "Konut Tipi", rows: [
        { id: "mulkekle:housing:ara_kat", title: "Ara Kat" },
        { id: "mulkekle:housing:en_ust_kat", title: "En Üst Kat" },
        { id: "mulkekle:housing:dubleks", title: "Dubleks" },
        { id: "mulkekle:housing:bahce_dubleksi", title: "Bahçe Dubleksi" },
        { id: "mulkekle:housing:cati_dubleksi", title: "Çatı Dubleksi" },
        { id: "mulkekle:housing:tripleks", title: "Tripleks" },
        { id: "mulkekle:housing:belirtme", title: "Belirtme" },
      ]},
    ]);
    return;
  }

  if (field === "housing") {
    const housingLabels: Record<string, string> = {
      ara_kat: "Ara Kat", en_ust_kat: "En Üst Kat", dubleks: "Dubleks",
      bahce_dubleksi: "Bahçe Dubleksi", cati_dubleksi: "Çatı Dubleksi", tripleks: "Tripleks",
    };
    const housing = value === "belirtme" ? null : housingLabels[value] || value;
    await updateSession(ctx.userId, "usage_select", { housing_type: housing });
    // Sahibinden kullanım: Boş, Kiracılı, Mülk Sahibi
    await sendButtons(ctx.phone, "🔑 Kullanım durumu:", [
      { id: "mulkekle:usage:bos", title: "Boş" },
      { id: "mulkekle:usage:kiracili", title: "Kiracılı" },
      { id: "mulkekle:usage:mulk_sahibi", title: "Mülk Sahibi" },
    ]);
    return;
  }

  if (field === "usage") {
    const usageLabels: Record<string, string> = { bos: "Boş", kiracili: "Kiracılı", mulk_sahibi: "Mülk Sahibi" };
    await updateSession(ctx.userId, "swap_select", { usage_status: usageLabels[value] || value });
    // Sahibinden takas: Evet / Hayır
    await sendButtons(ctx.phone, "🔄 Takas kabul edilir mi?", [
      { id: "mulkekle:swap:evet", title: "Evet" },
      { id: "mulkekle:swap:hayir", title: "Hayır" },
      { id: "mulkekle:swap:belirtme", title: "Belirtme" },
    ]);
    return;
  }

  if (field === "swap") {
    const swap = value === "evet" ? true : value === "hayir" ? false : null;
    await updateSession(ctx.userId, "bathroom_select", { swap });
    // Continue to bathroom
    await sendList(ctx.phone, "🚿 Banyo sayısı:", "Banyo", [
      { title: "Banyo Sayısı", rows: [
        { id: "mulkekle:bathroom:1", title: "1" },
        { id: "mulkekle:bathroom:2", title: "2" },
        { id: "mulkekle:bathroom:3", title: "3" },
        { id: "mulkekle:bathroom:4+", title: "4+" },
        { id: "mulkekle:bathroom:yok", title: "Belirtme" },
      ]},
    ]);
    return;
  }

  // ═══ AŞAMA 3 ═══

  if (field === "bathroom") {
    // Store sahibinden's exact label: "1", "2", "3", "4+"
    const bc = value === "yok" ? null : value;
    await updateSession(ctx.userId, "kitchen_select", { bathroom_count: bc });
    // Sahibinden mutfak: Açık (Amerikan) / Kapalı
    await sendButtons(ctx.phone, "🍳 Mutfak tipi:", [
      { id: "mulkekle:kitchen:acik_amerikan", title: "Açık (Amerikan)" },
      { id: "mulkekle:kitchen:kapali", title: "Kapalı" },
    ]);
    return;
  }

  if (field === "kitchen") {
    const kitchenLabels: Record<string, string> = { acik_amerikan: "Açık (Amerikan)", kapali: "Kapalı" };
    await updateSession(ctx.userId, "elevator_select", { kitchen_type: kitchenLabels[value] || value });
    await sendButtons(ctx.phone, "🛗 Asansör var mı?", [
      { id: "mulkekle:elevator:evet", title: "Evet" },
      { id: "mulkekle:elevator:hayir", title: "Hayır" },
    ]);
    return;
  }

  if (field === "elevator") {
    await updateSession(ctx.userId, "balcony_select", { elevator: value === "evet" });
    await sendButtons(ctx.phone, "🏠 Balkon var mı?", [
      { id: "mulkekle:balcony:evet", title: "Evet" },
      { id: "mulkekle:balcony:hayir", title: "Hayır" },
    ]);
    return;
  }

  if (field === "balcony") {
    await updateSession(ctx.userId, "int_features_select", { balcony: value === "evet" });
    // Start feature selection chain
    await sendList(ctx.phone, "🏷 İç özellik seçin:\n\nBirden fazla seçebilirsiniz — her seçimden sonra soracağım.", "Özellik Seç", [
      { title: "İç Özellikler", rows: [
        { id: "mulkekle:intfeat:ankastre", title: "Ankastre Mutfak" },
        { id: "mulkekle:intfeat:jakuzi", title: "Jakuzi" },
        { id: "mulkekle:intfeat:klima", title: "Klima" },
        { id: "mulkekle:intfeat:giyinme", title: "Giyinme Odası" },
        { id: "mulkekle:intfeat:ebeveyn", title: "Ebeveyn Banyosu" },
        { id: "mulkekle:intfeat:vestiyer", title: "Vestiyer" },
        { id: "mulkekle:intfeat:beyaz", title: "Beyaz Eşya" },
        { id: "mulkekle:intfeat:bitmis", title: "✅ Seçimi Bitir" },
      ]},
    ]);
    return;
  }

  // ═══ İÇ ÖZELLİKLER (tekrarlı seçim) ═══

  if (field === "intfeat") {
    const labels: Record<string, string> = {
      ankastre: "Ankastre Mutfak", jakuzi: "Jakuzi", klima: "Klima",
      giyinme: "Giyinme Odası", ebeveyn: "Ebeveyn Banyosu",
      vestiyer: "Vestiyer", beyaz: "Beyaz Eşya",
    };
    if (value === "menu") {
      await sendList(ctx.phone, "🏷 İç özellik seçin:", "Özellik Seç", [
        { title: "İç Özellikler", rows: [
          { id: "mulkekle:intfeat:ankastre", title: "Ankastre Mutfak" },
          { id: "mulkekle:intfeat:jakuzi", title: "Jakuzi" },
          { id: "mulkekle:intfeat:klima", title: "Klima" },
          { id: "mulkekle:intfeat:giyinme", title: "Giyinme Odası" },
          { id: "mulkekle:intfeat:ebeveyn", title: "Ebeveyn Banyosu" },
          { id: "mulkekle:intfeat:vestiyer", title: "Vestiyer" },
          { id: "mulkekle:intfeat:beyaz", title: "Beyaz Eşya" },
          { id: "mulkekle:intfeat:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
      return;
    }
    if (value === "bitmis") {
      // Move to dış özellikler
      await updateSession(ctx.userId, "ext_features_select", {});
      await sendList(ctx.phone, "🌿 Dış özellik seçin:", "Özellik Seç", [
        { title: "Dış Özellikler", rows: [
          { id: "mulkekle:extfeat:havuz", title: "Yüzme Havuzu" },
          { id: "mulkekle:extfeat:bahce", title: "Bahçe" },
          { id: "mulkekle:extfeat:guvenlik", title: "Güvenlik" },
          { id: "mulkekle:extfeat:otopark_alani", title: "Otopark Alanı" },
          { id: "mulkekle:extfeat:tenis", title: "Tenis Kortu" },
          { id: "mulkekle:extfeat:cocuk", title: "Çocuk Parkı" },
          { id: "mulkekle:extfeat:jenerator", title: "Jeneratör" },
          { id: "mulkekle:extfeat:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
    } else {
      // Add to list
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.interior_features as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "int_features_select", { interior_features: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi.\n\nBaşka özellik eklemek ister misiniz?`, [
        { id: "mulkekle:intfeat:bitmis", title: "Bitir" },
        { id: "mulkekle:intfeat:menu", title: "➕ Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ DIŞ ÖZELLİKLER (tekrarlı seçim) ═══

  if (field === "extfeat") {
    const labels: Record<string, string> = {
      havuz: "Yüzme Havuzu", bahce: "Bahçe", guvenlik: "Güvenlik",
      otopark_alani: "Otopark Alanı", tenis: "Tenis Kortu",
      cocuk: "Çocuk Parkı", jenerator: "Jeneratör",
    };
    if (value === "menu") {
      await sendList(ctx.phone, "🌿 Dış özellik seçin:", "Özellik Seç", [
        { title: "Dış Özellikler", rows: [
          { id: "mulkekle:extfeat:havuz", title: "Yüzme Havuzu" },
          { id: "mulkekle:extfeat:bahce", title: "Bahçe" },
          { id: "mulkekle:extfeat:guvenlik", title: "Güvenlik" },
          { id: "mulkekle:extfeat:otopark_alani", title: "Otopark Alanı" },
          { id: "mulkekle:extfeat:tenis", title: "Tenis Kortu" },
          { id: "mulkekle:extfeat:cocuk", title: "Çocuk Parkı" },
          { id: "mulkekle:extfeat:jenerator", title: "Jeneratör" },
          { id: "mulkekle:extfeat:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
      return;
    }
    if (value === "bitmis") {
      // Move to manzara
      await updateSession(ctx.userId, "view_select", {});
      await sendList(ctx.phone, "🏔 Manzara seçin:", "Manzara Seç", [
        { title: "Manzara", rows: [
          { id: "mulkekle:viewfeat:deniz", title: "Deniz" },
          { id: "mulkekle:viewfeat:doga", title: "Doğa" },
          { id: "mulkekle:viewfeat:gol", title: "Göl" },
          { id: "mulkekle:viewfeat:sehir", title: "Şehir" },
          { id: "mulkekle:viewfeat:havuz_m", title: "Havuz" },
          { id: "mulkekle:viewfeat:dag", title: "Dağ" },
          { id: "mulkekle:viewfeat:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
    } else {
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.exterior_features as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "ext_features_select", { exterior_features: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi. Başka?`, [
        { id: "mulkekle:extfeat:bitmis", title: "Bitir" },
        { id: "mulkekle:extfeat:menu", title: "➕ Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ MANZARA (tekrarlı seçim) ═══

  if (field === "viewfeat") {
    const labels: Record<string, string> = {
      deniz: "Deniz", doga: "Doğa", gol: "Göl", sehir: "Şehir",
      havuz_m: "Havuz", dag: "Dağ",
    };
    if (value === "menu") {
      await sendList(ctx.phone, "🏔 Manzara seçin:", "Manzara Seç", [
        { title: "Manzara", rows: [
          { id: "mulkekle:viewfeat:deniz", title: "Deniz" },
          { id: "mulkekle:viewfeat:doga", title: "Doğa" },
          { id: "mulkekle:viewfeat:gol", title: "Göl" },
          { id: "mulkekle:viewfeat:sehir", title: "Şehir" },
          { id: "mulkekle:viewfeat:havuz_m", title: "Havuz" },
          { id: "mulkekle:viewfeat:dag", title: "Dağ" },
          { id: "mulkekle:viewfeat:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
      return;
    }
    if (value === "bitmis") {
      // Move to ulaşım (list-based)
      await updateSession(ctx.userId, "transport_select", {});
      await sendList(ctx.phone, "🚌 Ulaşım seçin:", "Ulaşım Seç", [
        { title: "Ulaşım", rows: [
          { id: "mulkekle:transport:metro", title: "Metro" },
          { id: "mulkekle:transport:otobus", title: "Otobüs" },
          { id: "mulkekle:transport:minibus", title: "Minibüs / Dolmuş" },
          { id: "mulkekle:transport:tramvay", title: "Tramvay" },
          { id: "mulkekle:transport:deniz", title: "Deniz Ulaşımı" },
          { id: "mulkekle:transport:anayol", title: "Anayola Yakın" },
          { id: "mulkekle:transport:havaalani", title: "Havaalanı Yakın" },
          { id: "mulkekle:transport:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
    } else {
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.view_features as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "view_select", { view_features: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi. Başka?`, [
        { id: "mulkekle:viewfeat:bitmis", title: "Bitir" },
        { id: "mulkekle:viewfeat:menu", title: "➕ Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ ULAŞIM (tekrarlı seçim) ═══

  if (field === "transport") {
    const labels: Record<string, string> = {
      metro: "Metro", otobus: "Otobüs", minibus: "Minibüs / Dolmuş",
      tramvay: "Tramvay", deniz: "Deniz Ulaşımı",
      anayol: "Anayola Yakın", havaalani: "Havaalanı Yakın",
    };
    if (value === "menu") {
      await sendList(ctx.phone, "🚌 Ulaşım seçin:", "Ulaşım Seç", [
        { title: "Ulaşım", rows: [
          { id: "mulkekle:transport:metro", title: "Metro" },
          { id: "mulkekle:transport:otobus", title: "Otobüs" },
          { id: "mulkekle:transport:minibus", title: "Minibüs / Dolmuş" },
          { id: "mulkekle:transport:tramvay", title: "Tramvay" },
          { id: "mulkekle:transport:deniz", title: "Deniz Ulaşımı" },
          { id: "mulkekle:transport:anayol", title: "Anayola Yakın" },
          { id: "mulkekle:transport:havaalani", title: "Havaalanı Yakın" },
          { id: "mulkekle:transport:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
      return;
    }
    if (value === "bitmis") {
      // Move to açıklama
      await updateSession(ctx.userId, "desc_choice", {});
      await sendButtons(ctx.phone,
        "📝 *İlan Açıklaması*\n\nAçıklamayı nasıl eklemek istersiniz?\n\nAI seçerseniz, girdiğiniz tüm bilgileri kullanarak etkileyici bir açıklama yazarım.",
        [
          { id: "mulkekle:desc_choice:ai", title: "🤖 AI Yazsın" },
          { id: "mulkekle:desc_choice:manual", title: "✍️ Kendim Yazayım" },
          { id: "mulkekle:desc_choice:skip", title: "⏭ Geç" },
        ],
      );
    } else {
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.transportation as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "transport_select", { transportation: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi. Başka?`, [
        { id: "mulkekle:transport:bitmis", title: "Bitir" },
        { id: "mulkekle:transport:menu", title: "➕ Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ AÇIKLAMA (AI / Manuel / Geç) ═══

  if (field === "desc_choice") {
    if (value === "ai") {
      // Generate AI description from all collected data
      const sess = await getSession(ctx.userId);
      const d = (sess?.data as Record<string, unknown>) || {};
      try {
        const { generatePropertyDescription } = await import("@/platform/ai/claude");
        const aiDesc = await generatePropertyDescription(d);
        await updateSession(ctx.userId, "finalize_ready", { description: aiDesc, ai_description: aiDesc });
        await sendButtons(ctx.phone,
          `🤖 *AI Açıklama:*\n\n${aiDesc.substring(0, 800)}\n\n${aiDesc.length > 800 ? "..." : ""}`,
          [
            { id: "mulkekle:finalize:ok", title: "✅ Kullan ve Kaydet" },
            { id: "mulkekle:desc_choice:manual", title: "✍️ Kendim Yazayım" },
          ],
        );
      } catch {
        await sendText(ctx.phone, "AI açıklama oluşturulamadı. Kendiniz yazın veya geçin.");
        await updateSession(ctx.userId, "description_text", {});
      }
    } else if (value === "manual") {
      await updateSession(ctx.userId, "description_text", {});
      await sendText(ctx.phone, "📝 İlan açıklamasını yazın:");
    } else {
      // skip
      await updateSession(ctx.userId, "finalize_ready", {});
      await finalizeProperty(ctx);
    }
    return;
  }

  // ═══ FINALIZE ═══

  if (field === "finalize" && value === "ok") {
    await finalizeProperty(ctx);
    return;
  }
}

// ── Summary ────────────────────────────────────────────────────────────

async function showSummaryAndConfirm(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: sess } = await supabase
    .from("command_sessions").select("data").eq("user_id", ctx.userId).single();

  if (!sess) { await endSession(ctx.userId); await sendText(ctx.phone, "Hata. Tekrar deneyin."); return; }

  const d = sess.data as Record<string, unknown>;
  const priceStr = d.price ? new Intl.NumberFormat("tr-TR").format(d.price as number) : "—";
  const ltLabel = d.listing_type === "satilik" ? "Satılık" : "Kiralık";

  let s = `📋 *Mülk Özeti — Onay*\n\n`;
  s += `📌 ${d.title}\n💰 ${priceStr} TL | 🏷 ${ltLabel}\n`;
  s += `📐 ${d.m2 || "—"} m²`;
  if (d.net_area) s += ` (net: ${d.net_area})`;
  s += ` | 🛏 ${d.rooms || "—"}\n`;
  s += `🏠 ${TYPE_LABELS[d.type as string] || d.type || "—"}\n`;

  const loc = [d.neighborhood, d.district, d.city].filter(Boolean).join(", ");
  if (loc) s += `📍 ${loc}\n`;
  if (d.floor !== undefined && d.floor !== null) {
    s += `🏢 Kat: ${d.floor}`;
    if (d.total_floors) s += ` / ${d.total_floors}`;
    s += `\n`;
  }
  if (d.building_age !== undefined && d.building_age !== null) s += `🏗 Bina yaşı: ${d.building_age}\n`;
  if (d.heating) s += `🔥 ${d.heating}\n`;
  if (d.parking) s += `🅿️ ${d.parking}\n`;
  if (d.facade) s += `🧭 ${d.facade}\n`;
  if (d.deed_type) s += `📜 ${d.deed_type}\n`;
  if (d.housing_type) s += `🏗 ${d.housing_type}\n`;
  if (d.usage_status) s += `🔑 ${d.usage_status}\n`;
  if (d.swap === true) s += `🔄 Takas: Evet\n`;
  if (d.bathroom_count) s += `🚿 Banyo: ${d.bathroom_count}\n`;
  if (d.kitchen_type) s += `🍳 ${d.kitchen_type}\n`;
  if (d.elevator === true) s += `🛗 Asansör: Var\n`;
  if (d.balcony === true) s += `🏠 Balkon: Var\n`;
  if (d.description) s += `\n📝 ${(d.description as string).substring(0, 200)}\n`;

  await sendButtons(ctx.phone, s, [
    { id: "mulkekle:finalize:ok", title: "✅ Kaydet" },
    { id: "cmd:mulkekle", title: "🔄 Baştan Başla" },
  ]);
}

// ── Finalize ───────────────────────────────────────────────────────────

async function finalizeProperty(ctx: WaContext): Promise<void> {
  const supabase = getServiceClient();
  const { data: session } = await supabase
    .from("command_sessions").select("data").eq("user_id", ctx.userId).single();

  if (!session) { await endSession(ctx.userId); await sendText(ctx.phone, "Hata. Tekrar deneyin."); return; }

  const d = session.data as Record<string, unknown>;

  const { error } = await supabase.from("emlak_properties").insert({
    tenant_id: ctx.tenantId, user_id: ctx.userId,
    title: d.title, price: d.price, area: d.m2, net_area: d.net_area || null,
    rooms: d.rooms, listing_type: d.listing_type, type: d.type || "daire",
    location_city: d.city || null, location_district: d.district || null,
    location_neighborhood: d.neighborhood || null,
    floor: d.floor !== undefined ? d.floor : null, total_floors: d.total_floors || null,
    building_age: d.building_age !== undefined ? d.building_age : null,
    heating: d.heating || null, parking: d.parking || null, facade: d.facade || null,
    deed_type: d.deed_type || null, housing_type: d.housing_type || null,
    usage_status: d.usage_status || null, swap: d.swap ?? null,
    bathroom_count: d.bathroom_count || null, kitchen_type: d.kitchen_type || null,
    elevator: d.elevator ?? null, balcony: d.balcony ?? null,
    description: d.description || null, interior_features: d.interior_features || null,
    exterior_features: d.exterior_features || null, view_features: d.view_features || null,
    transportation: d.transportation || null, status: "aktif",
  });

  await endSession(ctx.userId);

  if (error) {
    await sendButtons(ctx.phone, "❌ Mülk eklenirken hata oluştu.", [
      { id: "cmd:mulkekle", title: "Tekrar Dene" }, { id: "cmd:menu", title: "Ana Menü" },
    ]);
    return;
  }

  const priceStr = new Intl.NumberFormat("tr-TR").format(d.price as number);
  const ltLabel = d.listing_type === "satilik" ? "Satılık" : "Kiralık";
  const location = [d.neighborhood, d.district, d.city].filter(Boolean).join(", ");

  // Gamification: trigger FIRST so the XP popup comes right after success msg
  // and the popup's CTA becomes the ONLY next step (corridor pattern).
  await sendText(ctx.phone,
    `✅ Mülk başarıyla eklendi!\n\n📋 ${d.title}\n💰 ${priceStr} TL\n📐 ${d.m2} m²\n🛏 ${d.rooms}\n🏷 ${ltLabel}` +
    (location ? `\n📍 ${location}` : ""),
  );

  // Discovery chain: advance if user is in guided first-use flow
  try {
    const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
    await advanceDiscovery(ctx.userId, ctx.phone, "mulk_eklendi");
  } catch { /* don't break main flow */ }

  // Check for customer matches
  try {
    const { data: customers } = await supabase
      .from("emlak_customers")
      .select("id, name, budget_min, budget_max, preferred_location, listing_type")
      .eq("user_id", ctx.userId);

    if (customers?.length) {
      const insertedPrice = d.price as number;
      const insertedType = d.listing_type as string;
      const matches = customers.filter((c) => {
        if (c.listing_type && c.listing_type !== insertedType) return false;
        if (c.budget_max && insertedPrice > c.budget_max) return false;
        if (c.budget_min && insertedPrice < c.budget_min) return false;
        return true;
      });
      if (matches.length > 0) {
        const names = matches.slice(0, 3).map((m) => m.name).join(", ");
        // Plain text info — no buttons that would conflict with XP popup CTA
        await sendText(ctx.phone, `🤝 ${matches.length} müşteriniz bu mülke uygun: ${names}`);
      }
    }
  } catch { /* don't break main flow */ }
}

// ── Price parser ────────────────────────────────────────────────────────

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/TL/gi, "").replace(/-/g, "").trim();
  const mMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(?:M|milyon)$/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1].replace(",", ".")) * 1_000_000);
  const binMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*bin$/i);
  if (binMatch) return Math.round(parseFloat(binMatch[1].replace(",", ".")) * 1_000);
  const num = parseInt(cleaned.replace(/[.\s]/g, "").replace(",", ""), 10);
  return isNaN(num) ? null : num;
}
