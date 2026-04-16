import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession } from "@/platform/whatsapp/session";
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
      { id: "mulkekle_method:link", title: "🔗 Link yapıştır" },
      { id: "mulkekle_method:detayli", title: "📝 Detaylı ekle" },
      { id: "mulkekle_method:hizli", title: "⚡ Hızlı ekle" },
    ],
  );
  await sendButtons(ctx.phone, "Veya:", [
    { id: "cmd:menu", title: "📋 Ana Menü" },
  ]);
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
      await updateSession(ctx.userId, "finalize_ready", { district });
      // Fast flow: finalize immediately after district.
      // Neighborhood, phases 2+3 (kat/bina yaşı/ısınma/cephe/banyo/mutfak/
      // asansör/balkon/açıklama/özellikler) are all skipped — user fills
      // them later via "bilgi tamamla" mission + AI description wizard.
      await finalizeProperty(ctx);
      return;
    }

    // ── AŞAMA 3: Açıklama + Özellikler (serbest metin) ──

    case "description": {
      const desc = skip ? null : text;
      await updateSession(ctx.userId, "features_input", { description: desc });
      await sendText(ctx.phone,
        "🏷 İç özellikler yazın (virgülle ayırın):\n\n" +
        "Örnek: Ankastre mutfak, Jakuzi, Giyinme odası\n\n(\"geç\" ile atlayın)"
      );
      return;
    }

    case "features_input": {
      const features = skip ? null : text;
      await updateSession(ctx.userId, "exterior_input", { interior_features: features });
      await sendText(ctx.phone,
        "🌿 Dış özellikler yazın (virgülle ayırın):\n\n" +
        "Örnek: Yüzme havuzu, Bahçe, Güvenlik\n\n(\"geç\" ile atlayın)"
      );
      return;
    }

    case "exterior_input": {
      const ext = skip ? null : text;
      await updateSession(ctx.userId, "view_input", { exterior_features: ext });
      await sendText(ctx.phone,
        "🏔 Manzara yazın (virgülle ayırın):\n\n" +
        "Örnek: Deniz, Doğa, Göl, Şehir\n\n(\"geç\" ile atlayın)"
      );
      return;
    }

    case "view_input": {
      const view = skip ? null : text;
      await updateSession(ctx.userId, "transport_input", { view_features: view });
      await sendText(ctx.phone,
        "🚌 Ulaşım bilgisi yazın:\n\n" +
        "Örnek: Metro 500m, Otobüs 200m\n\n(\"geç\" ile atlayın)"
      );
      return;
    }

    case "transport_input": {
      const transport = skip ? null : text;
      await updateSession(ctx.userId, "phase3_done", { transportation: transport });
      await showSummaryAndConfirm(ctx);
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
    // Store as boolean for DB compat. fill-data endpoint converts to "Evet"/"Hayır" text for sahibinden.
    const swap = value === "evet" ? true : value === "hayir" ? false : null;
    await updateSession(ctx.userId, "phase2_done", { swap });
    // Corridor: auto-continue to Phase 3, no shortcut.
    await sendText(ctx.phone, "✅ *Aşama 2 tamamlandı* — Bina Bilgileri\n\nDetaylara geçiyoruz...");
    await handleMulkEkleCallback(ctx, "mulkekle:phase:3");
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
    await updateSession(ctx.userId, "description", { balcony: value === "evet" });
    await sendText(ctx.phone,
      "📝 Açıklama yazın:\n\nMülkü tanımlayan detaylı metin.\n\n(\"geç\" ile atlayın)"
    );
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

  // Gamification: mission trigger — the XP popup provides the next-step CTA
  // (e.g. [✏️ Bilgileri Düzenle]). No extra [Portföyüm][Ana Menü] buttons
  // that would let the user stray from the corridor.
  try {
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
