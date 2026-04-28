import type { WaContext } from "@/platform/whatsapp/types";
import type { CommandSession } from "@/platform/whatsapp/session";
import { startSession, updateSession, endSession, getSession } from "@/platform/whatsapp/session";
import { sendText, sendButtons, sendList, sendNavFooter } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";

// ── Constants ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  daire: "Daire", villa: "Villa", mustakil: "Müstakil", rezidans: "Rezidans",
  arsa: "Arsa", isyeri: "İşyeri", dukkan: "Dükkan", buro_ofis: "Büro/Ofis",
};

// ── Feature list helpers ───────────────────────────────────────────────

const INTFEAT_ITEMS: { id: string; label: string }[] = [
  { id: "adsl", label: "ADSL" },
  { id: "ahsap_dograma", label: "Ahşap Doğrama" },
  { id: "akilli_ev", label: "Akıllı Ev" },
  { id: "alarm_yangin", label: "Alarm (Yangın)" },
  { id: "alarm_hirsiz", label: "Alarm (Hırsız)" },
  { id: "alaturka_tuvalet", label: "Alaturka Tuvalet" },
  { id: "aluminyum_dograma", label: "Alüminyum Doğrama" },
  { id: "amerikan_kapi", label: "Amerikan Kapı" },
  { id: "ankastre_firin", label: "Ankastre Fırın" },
  { id: "barbeku", label: "Barbekü" },
  { id: "beyaz_esya", label: "Beyaz Eşya" },
  { id: "boyali", label: "Boyalı" },
  { id: "bulasik_mak", label: "Bulaşık Makinesi" },
  { id: "buzdolabi", label: "Buzdolabı" },
  { id: "camasir_kurutma", label: "Çamaşır Kurutma Makinesi" },
  { id: "camasir_mak", label: "Çamaşır Makinesi" },
  { id: "camasir_odasi", label: "Çamaşır Odası" },
  { id: "celik_kapi", label: "Çelik Kapı" },
  { id: "dusakabin", label: "Duşakabin" },
  { id: "duvar_kagidi", label: "Duvar Kağıdı" },
  { id: "ebeveyn_banyo", label: "Ebeveyn Banyosu" },
  { id: "fiber_internet", label: "Fiber İnternet" },
  { id: "firin", label: "Fırın" },
  { id: "giyinme_odasi", label: "Giyinme Odası" },
  { id: "gomme_dolap", label: "Gömme Dolap" },
  { id: "goruntulu_diyafon", label: "Görüntülü Diyafon" },
  { id: "hilton_banyo", label: "Hilton Banyo" },
  { id: "intercom", label: "Intercom Sistemi" },
  { id: "isicam", label: "Isıcam" },
  { id: "jakuzi", label: "Jakuzi" },
  { id: "kapali_balkon", label: "Kapalı/Cam Balkon" },
  { id: "kartonpiyer", label: "Kartonpiyer" },
  { id: "kiler", label: "Kiler" },
  { id: "klima", label: "Klima" },
  { id: "kuvet", label: "Küvet" },
  { id: "laminat_zemin", label: "Laminat Zemin" },
  { id: "marley", label: "Marley" },
  { id: "mobilya", label: "Mobilya" },
  { id: "mutfak_dogalgaz", label: "Mutfak Doğalgazı" },
  { id: "mutfak_ankastre", label: "Mutfak (Ankastre)" },
  { id: "mutfak_laminat", label: "Mutfak (Laminat)" },
  { id: "panjur_jaluzi", label: "Panjur/Jaluzi" },
  { id: "parke_zemin", label: "Parke Zemin" },
  { id: "pvc_dograma", label: "PVC Doğrama" },
  { id: "seramik_zemin", label: "Seramik Zemin" },
  { id: "set_ustu_ocak", label: "Set Üstü Ocak" },
  { id: "spot_aydinlatma", label: "Spot Aydınlatma" },
  { id: "sofben", label: "Şofben" },
  { id: "somine", label: "Şömine" },
  { id: "teras", label: "Teras" },
  { id: "termosifon", label: "Termosifon" },
  { id: "vestiyer", label: "Vestiyer" },
  { id: "yuz_tanima", label: "Yüz Tanıma & Parmak İzi" },
];

const EXTFEAT_ITEMS: { id: string; label: string }[] = [
  { id: "arac_sarj", label: "Araç Şarj İstasyonu" },
  { id: "guvenlik_24", label: "24 Saat Güvenlik" },
  { id: "apartman_gorevlisi", label: "Apartman Görevlisi" },
  { id: "buhar_odasi", label: "Buhar Odası" },
  { id: "cocuk_parki", label: "Çocuk Oyun Parkı" },
  { id: "hamam", label: "Hamam" },
  { id: "hidrofor", label: "Hidrofor" },
  { id: "isi_yalitim", label: "Isı Yalıtımı" },
  { id: "jenerator", label: "Jeneratör" },
  { id: "kablo_tv", label: "Kablo TV" },
  { id: "kamera", label: "Kamera Sistemi" },
  { id: "kopek_parki", label: "Köpek Parkı" },
  { id: "kres", label: "Kreş" },
  { id: "mustakil_havuz", label: "Müstakil Havuzlu" },
  { id: "sauna", label: "Sauna" },
  { id: "ses_yalitim", label: "Ses Yalıtımı" },
  { id: "siding", label: "Siding" },
  { id: "spor_alani", label: "Spor Alanı" },
  { id: "su_deposu", label: "Su Deposu" },
  { id: "tenis_kortu", label: "Tenis Kortu" },
  { id: "uydu", label: "Uydu" },
  { id: "yangin_merdiveni", label: "Yangın Merdiveni" },
  { id: "havuz_acik", label: "Yüzme Havuzu (Açık)" },
  { id: "havuz_kapali", label: "Yüzme Havuzu (Kapalı)" },
];

const VIEWFEAT_ITEMS: { id: string; label: string }[] = [
  { id: "deniz", label: "Deniz" },
  { id: "doga", label: "Doğa" },
  { id: "gol", label: "Göl" },
  { id: "sehir", label: "Şehir" },
  { id: "havuz_m", label: "Havuz" },
  { id: "dag", label: "Dağ" },
  { id: "bogaz", label: "Boğaz" },
  { id: "park_yesil", label: "Park/Yeşil Alan" },
  { id: "otopark_m", label: "Otopark" },
];

const MUHIT_ITEMS: { id: string; label: string }[] = [
  { id: "avm", label: "Alışveriş Merkezi" },
  { id: "belediye", label: "Belediye" },
  { id: "cami", label: "Cami" },
  { id: "cemevi", label: "Cemevi" },
  { id: "denize_sifir", label: "Denize Sıfır" },
  { id: "eczane", label: "Eczane" },
  { id: "eglence", label: "Eğlence Merkezi" },
  { id: "fuar", label: "Fuar" },
  { id: "gole_sifir", label: "Göle Sıfır" },
  { id: "hastane", label: "Hastane" },
  { id: "havra", label: "Havra" },
  { id: "ilkokul", label: "İlkokul-Ortaokul" },
  { id: "itfaiye", label: "İtfaiye" },
  { id: "kilise", label: "Kilise" },
  { id: "lise", label: "Lise" },
  { id: "market", label: "Market" },
  { id: "park", label: "Park" },
  { id: "plaj", label: "Plaj" },
  { id: "polis", label: "Polis Merkezi" },
  { id: "saglik_ocagi", label: "Sağlık Ocağı" },
  { id: "semt_pazari", label: "Semt Pazarı" },
  { id: "spor_salonu", label: "Spor Salonu" },
  { id: "sehir_merkezi", label: "Şehir Merkezi" },
  { id: "universite", label: "Üniversite" },
];

const ENGELLI_ITEMS: { id: string; label: string }[] = [
  { id: "arac_park", label: "Araç Park Yeri" },
  { id: "asansor", label: "Engelliye Uygun Asansör" },
  { id: "banyo", label: "Engelliye Uygun Banyo" },
  { id: "mutfak", label: "Engelliye Uygun Mutfak" },
  { id: "park_engelli", label: "Engelliye Uygun Park" },
  { id: "genis_koridor", label: "Geniş Koridor" },
  { id: "giris_rampa", label: "Giriş/Rampa" },
  { id: "merdiven", label: "Merdiven" },
  { id: "oda_kapisi", label: "Oda Kapısı" },
  { id: "priz_anahtar", label: "Priz/Elektrik Anahtarı" },
  { id: "tutamak", label: "Tutamak/Korkuluk" },
  { id: "tuvalet_engelli", label: "Tuvalet" },
  { id: "havuz_engelli", label: "Yüzme Havuzu" },
];

const TRANSPORT_ITEMS: { id: string; label: string }[] = [
  { id: "anayol", label: "Anayol" },
  { id: "avrasya", label: "Avrasya Tüneli" },
  { id: "bogaz_kopru", label: "Boğaz Köprüleri" },
  { id: "cadde", label: "Cadde" },
  { id: "deniz_otobusu", label: "Deniz Otobüsü" },
  { id: "dolmus", label: "Dolmuş" },
  { id: "e5", label: "E-5" },
  { id: "havaalani", label: "Havaalanı" },
  { id: "iskele", label: "İskele" },
  { id: "marmaray", label: "Marmaray" },
  { id: "metro", label: "Metro" },
  { id: "metrobus", label: "Metrobüs" },
  { id: "minibus", label: "Minibüs" },
  { id: "otobus", label: "Otobüs Durağı" },
  { id: "sahil", label: "Sahil" },
  { id: "tem", label: "TEM" },
  { id: "tramvay", label: "Tramvay" },
  { id: "tren", label: "Tren İstasyonu" },
];

const FEATURE_PAGE_SIZE = 7;

/**
 * Build a single-page section for a feature list.
 * WhatsApp list limit = 10 rows total. Middle page: 7 + Sonraki + Önceki + Bitir = 10.
 */
function buildFeatureSections(
  items: { id: string; label: string }[],
  callbackPrefix: string,
  sectionTitle: string,
  page = 0,
): { title: string; rows: { id: string; title: string }[] }[] {
  const totalPages = Math.max(1, Math.ceil(items.length / FEATURE_PAGE_SIZE));
  const p = Math.min(Math.max(0, page), totalPages - 1);
  const start = p * FEATURE_PAGE_SIZE;
  const chunk = items.slice(start, start + FEATURE_PAGE_SIZE);

  const rows: { id: string; title: string }[] = chunk.map((i) => ({
    id: `${callbackPrefix}:${i.id}:${p}`,
    title: i.label,
  }));

  if (p + 1 < totalPages) {
    rows.push({ id: `${callbackPrefix}:sayfa:${p + 1}`, title: "➡️ Sonraki Sayfa" });
  }
  if (p > 0) {
    rows.push({ id: `${callbackPrefix}:sayfa:${p - 1}`, title: "⬅️ Önceki Sayfa" });
  }
  rows.push({ id: `${callbackPrefix}:bitmis`, title: "✅ Seçimi Bitir" });

  const title = totalPages > 1 ? `${sectionTitle} (${p + 1}/${totalPages})` : sectionTitle;
  return [{ title, rows }];
}

/** Build label lookup from feature items */
function buildLabels(items: { id: string; label: string }[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const i of items) m[i.id] = i.label;
  return m;
}

// ── Menu: choose add method ─────────────────────────────────────────────

export async function handleMulkEkleMenu(ctx: WaContext): Promise<void> {
  // Generate a 2h magic link for the web form
  const { getServiceClient } = await import("@/platform/auth/supabase");
  const supabase = getServiceClient();
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("magic_link_tokens").insert({
    user_id: ctx.userId,
    token,
    expires_at: expiresAt,
  });
  const formUrl = `https://estateai.upudev.nl/tr/mulkekle-form?t=${token}`;

  const { sendUrlButton } = await import("@/platform/whatsapp/send");
  await sendUrlButton(ctx.phone,
    `🏠 *Mülk Ekle*\n\nMülk bilgilerini doldurman için sana özel bir form hazırladım. Formu aç, kolayca doldur, kaydet butonuyla WhatsApp'a dön.\n\n_Link 1 hafta geçerlidir._`,
    "📝 Formu Aç",
    formUrl,
    { skipNav: true },
  );
}

// ── Start detaylı flow ─────────────────────────────────────────────────

export async function handleMulkEkle(ctx: WaContext): Promise<void> {
  await startSession(ctx.userId, ctx.tenantId, "mulkekle", "title");
  await sendText(ctx.phone,
    "🏠 *Detaylı Mülk Ekleme*\n\n" +
    "📋 Aşama 1/3 — Temel Bilgiler\n\n" +
    "_Hata yaparsanız sorun değil, devam edin — daha sonra düzeltebilirsiniz._\n\n" +
    "İlan başlığını yazın:\n\nÖrnek: \"Yalıkavak Kiralık 2+1 Daire\""
  );
  await sendNavFooter(ctx.phone);
}

// ── Step handler (text inputs only) ─────────────────────────────────────

export async function handleMulkEkleStep(ctx: WaContext, session: CommandSession): Promise<void> {
  const step = session.current_step;
  const text = ctx.text;
  const skip = text?.toLowerCase() === "geç";

  if (!text) {
    await sendText(ctx.phone, "Lütfen bir değer yazın. (\"geç\" ile atlayın)");
    await sendNavFooter(ctx.phone);
    return;
  }

  switch (step) {
    // ── AŞAMA 1: Temel Bilgiler ──

    case "title": {
      if (text.length < 3) {
        await sendText(ctx.phone, "Başlık en az 3 karakter olmalı:");
        await sendNavFooter(ctx.phone);
        return;
      }
      await updateSession(ctx.userId, "price", { title: text });
      await sendText(ctx.phone, "💰 Fiyatı yazın:\n\nÖrnek: 4.5M, 25 bin, 750.000");
      await sendNavFooter(ctx.phone);
      return;
    }

    case "price": {
      const price = parsePrice(text);
      if (!price) {
        await sendText(ctx.phone, "Geçerli fiyat yazın. Örnek: 4.5M, 25 bin");
        await sendNavFooter(ctx.phone);
        return;
      }
      await updateSession(ctx.userId, "m2", { price });
      await sendText(ctx.phone, "📐 Brüt metrekare yazın:\n\nÖrnek: 120");
      await sendNavFooter(ctx.phone);
      return;
    }

    case "m2": {
      const m2 = parseInt(text.replace(/[^\d]/g, ""), 10);
      if (!m2 || m2 < 1) {
        await sendText(ctx.phone, "Geçerli metrekare yazın:");
        await sendNavFooter(ctx.phone);
        return;
      }
      await updateSession(ctx.userId, "net_area", { m2 });
      await sendText(ctx.phone, "📐 Net metrekare yazın:\n\nÖrnek: 95\n\n(\"geç\" ile atlayın)");
      await sendNavFooter(ctx.phone);
      return;
    }

    case "city": {
      const city = skip ? null : text;
      await updateSession(ctx.userId, "district", { city });
      await sendText(ctx.phone, "📍 İlçe yazın:\n\nÖrnek: Bodrum\n\n(\"geç\" ile atlayın)");
      await sendNavFooter(ctx.phone);
      return;
    }

    case "district": {
      const district = skip ? null : text;
      await updateSession(ctx.userId, "neighborhood", { district });
      await sendText(ctx.phone, "📍 Mahalle yazın:\n\nÖrnek: Yalıkavak, Bitez\n\n(\"geç\" ile atlayın)");
      await sendNavFooter(ctx.phone);
      return;
    }

    case "neighborhood": {
      const neighborhood = skip ? null : text;
      await updateSession(ctx.userId, "floor_select", { neighborhood });
      // Continue to floor LIST (callback-based chain: floor → totalfloors → buildingage → heating → ... → finalize)
      await handleMulkEkleCallback(ctx, "mulkekle:phase:2");
      return;
    }

    case "net_area": {
      const netArea = skip ? null : parseInt(text.replace(/[^\d]/g, ""), 10) || null;
      await updateSession(ctx.userId, "rooms", { net_area: netArea });
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
      await sendNavFooter(ctx.phone);
      return;
  }
}

// ── Callback handler (list/button selections) ───────────────────────────

export async function handleMulkEkleCallback(ctx: WaContext, data: string): Promise<void> {
  const parts = data.split(":");
  if (parts.length < 3) return;
  const [, field, value] = parts;
  const pageArg = parseInt(parts[3] ?? "0", 10) || 0;

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
    await sendList(ctx.phone, "🔥 Isınma tipi seçin (birden fazla seçebilirsiniz):", "Isınma", [
      { title: "Isınma", rows: [
        { id: "mulkekle:heating:kombi", title: "Kombi (Doğalgaz)" },
        { id: "mulkekle:heating:merkezi", title: "Merkezi" },
        { id: "mulkekle:heating:yerden", title: "Yerden Isıtma" },
        { id: "mulkekle:heating:klima", title: "Klima" },
        { id: "mulkekle:heating:soba", title: "Soba" },
        { id: "mulkekle:heating:yok_isinma", title: "Yok" },
        { id: "mulkekle:heating:bitmis", title: "✅ Seçimi Bitir" },
      ]},
    ]);
    return;
  }

  if (field === "heating") {
    const heatingLabels: Record<string, string> = {
      kombi: "Kombi (Doğalgaz)", merkezi: "Merkezi", yerden: "Yerden Isıtma",
      klima: "Klima", soba: "Soba", yok_isinma: "Yok",
    };
    if (value === "menu") {
      await sendList(ctx.phone, "🔥 Isınma tipi seçin (birden fazla seçebilirsiniz):", "Isınma", [
        { title: "Isınma", rows: [
          { id: "mulkekle:heating:kombi", title: "Kombi (Doğalgaz)" },
          { id: "mulkekle:heating:merkezi", title: "Merkezi" },
          { id: "mulkekle:heating:yerden", title: "Yerden Isıtma" },
          { id: "mulkekle:heating:klima", title: "Klima" },
          { id: "mulkekle:heating:soba", title: "Soba" },
          { id: "mulkekle:heating:yok_isinma", title: "Yok" },
          { id: "mulkekle:heating:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
      return;
    }
    if (value === "bitmis") {
      // Move to otopark (heating already accumulated in session.data.heating)
      await updateSession(ctx.userId, "parking_select", {});
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
    // Add a heating option to the comma-separated list
    const label = heatingLabels[value] || value;
    const sess = await getSession(ctx.userId);
    const existing = ((sess?.data as Record<string, unknown>)?.heating as string) || "";
    const added = existing ? `${existing}, ${label}` : label;
    await updateSession(ctx.userId, "heating_select", { heating: added });
    await sendButtons(ctx.phone, `✅ ${label} eklendi. Başka ısınma tipi var mı?`, [
      { id: "mulkekle:heating:bitmis", title: "Bitir" },
      { id: "mulkekle:heating:menu", title: "Başka Ekle" },
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
    await sendList(ctx.phone, "🧭 Cephe yönü seçin (birden fazla seçebilirsiniz):", "Cephe", [
      { title: "Cephe Yönü", rows: [
        { id: "mulkekle:facade:kuzey", title: "Kuzey" },
        { id: "mulkekle:facade:guney", title: "Güney" },
        { id: "mulkekle:facade:dogu", title: "Doğu" },
        { id: "mulkekle:facade:bati", title: "Batı" },
        { id: "mulkekle:facade:bitmis", title: "✅ Seçimi Bitir" },
      ]},
    ]);
    return;
  }

  if (field === "facade") {
    const facadeLabels: Record<string, string> = {
      kuzey: "Kuzey", guney: "Güney", dogu: "Doğu", bati: "Batı",
    };
    if (value === "menu") {
      await sendList(ctx.phone, "🧭 Cephe yönü seçin (birden fazla seçebilirsiniz):", "Cephe", [
        { title: "Cephe Yönü", rows: [
          { id: "mulkekle:facade:kuzey", title: "Kuzey" },
          { id: "mulkekle:facade:guney", title: "Güney" },
          { id: "mulkekle:facade:dogu", title: "Doğu" },
          { id: "mulkekle:facade:bati", title: "Batı" },
          { id: "mulkekle:facade:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
      return;
    }
    if (value === "bitmis") {
      await updateSession(ctx.userId, "deed_select", {});
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
    const label = facadeLabels[value] || value;
    const sess = await getSession(ctx.userId);
    const existing = ((sess?.data as Record<string, unknown>)?.facade as string) || "";
    const added = existing ? `${existing}, ${label}` : label;
    await updateSession(ctx.userId, "facade_select", { facade: added });
    await sendButtons(ctx.phone, `✅ ${label} eklendi. Başka cephe var mı?`, [
      { id: "mulkekle:facade:bitmis", title: "Bitir" },
      { id: "mulkekle:facade:menu", title: "Başka Ekle" },
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
    // Start feature selection chain — İç Özellikler
    const sections = buildFeatureSections(INTFEAT_ITEMS, "mulkekle:intfeat", "İç Özellikler");
    await sendList(ctx.phone, "🏷 İç özellik seçin:\n\nBirden fazla seçebilirsiniz — her seçimden sonra soracağım.", "Özellik Seç", sections);
    return;
  }

  // ═══ İÇ ÖZELLİKLER (tekrarlı seçim) ═══

  if (field === "intfeat") {
    const labels = buildLabels(INTFEAT_ITEMS);
    if (value === "sayfa" || value === "menu") {
      const sections = buildFeatureSections(INTFEAT_ITEMS, "mulkekle:intfeat", "İç Özellikler", pageArg);
      await sendList(ctx.phone, "🏷 İç özellik seçin:", "Özellik Seç", sections);
      return;
    }
    if (value === "bitmis") {
      // Move to dış özellikler
      await updateSession(ctx.userId, "ext_features_select", {});
      const sections = buildFeatureSections(EXTFEAT_ITEMS, "mulkekle:extfeat", "Dış Özellikler");
      await sendList(ctx.phone, "🌿 Dış özellik seçin:", "Özellik Seç", sections);
    } else {
      // Add to list
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.interior_features as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "int_features_select", { interior_features: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi.\n\nBaşka özellik eklemek ister misiniz?`, [
        { id: "mulkekle:intfeat:bitmis", title: "Bitir" },
        { id: `mulkekle:intfeat:menu:${pageArg}`, title: "Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ DIŞ ÖZELLİKLER (tekrarlı seçim) ═══

  if (field === "extfeat") {
    const labels = buildLabels(EXTFEAT_ITEMS);
    if (value === "sayfa" || value === "menu") {
      const sections = buildFeatureSections(EXTFEAT_ITEMS, "mulkekle:extfeat", "Dış Özellikler", pageArg);
      await sendList(ctx.phone, "🌿 Dış özellik seçin:", "Özellik Seç", sections);
      return;
    }
    if (value === "bitmis") {
      // Move to manzara
      await updateSession(ctx.userId, "view_select", {});
      const sections = buildFeatureSections(VIEWFEAT_ITEMS, "mulkekle:viewfeat", "Manzara");
      await sendList(ctx.phone, "🏔 Manzara seçin:", "Manzara Seç", sections);
    } else {
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.exterior_features as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "ext_features_select", { exterior_features: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi. Başka?`, [
        { id: "mulkekle:extfeat:bitmis", title: "Bitir" },
        { id: `mulkekle:extfeat:menu:${pageArg}`, title: "Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ MANZARA (tekrarlı seçim) ═══

  if (field === "viewfeat") {
    const labels = buildLabels(VIEWFEAT_ITEMS);
    if (value === "sayfa" || value === "menu") {
      const sections = buildFeatureSections(VIEWFEAT_ITEMS, "mulkekle:viewfeat", "Manzara", pageArg);
      await sendList(ctx.phone, "🏔 Manzara seçin:", "Manzara Seç", sections);
      return;
    }
    if (value === "bitmis") {
      // Move to muhit (çevre)
      await updateSession(ctx.userId, "muhit_select", {});
      const sections = buildFeatureSections(MUHIT_ITEMS, "mulkekle:muhit", "Muhit");
      await sendList(ctx.phone, "📍 Muhit / Çevre seçin:", "Muhit Seç", sections);
    } else {
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.view_features as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "view_select", { view_features: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi. Başka?`, [
        { id: "mulkekle:viewfeat:bitmis", title: "Bitir" },
        { id: `mulkekle:viewfeat:menu:${pageArg}`, title: "Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ MUHİT / ÇEVRE (tekrarlı seçim) ═══

  if (field === "muhit") {
    const labels = buildLabels(MUHIT_ITEMS);
    if (value === "sayfa" || value === "menu") {
      const sections = buildFeatureSections(MUHIT_ITEMS, "mulkekle:muhit", "Muhit", pageArg);
      await sendList(ctx.phone, "📍 Muhit / Çevre seçin:", "Muhit Seç", sections);
      return;
    }
    if (value === "bitmis") {
      // Move to engelliye uygun
      await updateSession(ctx.userId, "engelli_select", {});
      const sections = buildFeatureSections(ENGELLI_ITEMS, "mulkekle:engelli", "Engelliye Uygun");
      await sendList(ctx.phone, "♿ Engelliye uygun özellik seçin:", "Engelli Seç", sections);
    } else {
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.neighborhood_features as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "muhit_select", { neighborhood_features: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi. Başka?`, [
        { id: "mulkekle:muhit:bitmis", title: "Bitir" },
        { id: `mulkekle:muhit:menu:${pageArg}`, title: "Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ ENGELLİYE UYGUN (tekrarlı seçim) ═══

  if (field === "engelli") {
    const labels = buildLabels(ENGELLI_ITEMS);
    if (value === "sayfa" || value === "menu") {
      const sections = buildFeatureSections(ENGELLI_ITEMS, "mulkekle:engelli", "Engelliye Uygun", pageArg);
      await sendList(ctx.phone, "♿ Engelliye uygun özellik seçin:", "Engelli Seç", sections);
      return;
    }
    if (value === "bitmis") {
      // Move to ulaşım
      await updateSession(ctx.userId, "transport_select", {});
      const sections = buildFeatureSections(TRANSPORT_ITEMS, "mulkekle:transport", "Ulaşım");
      await sendList(ctx.phone, "🚌 Ulaşım seçin:", "Ulaşım Seç", sections);
    } else {
      const sess = await getSession(ctx.userId);
      const existing = ((sess?.data as Record<string, unknown>)?.disability_features as string) || "";
      const added = existing ? `${existing}, ${labels[value] || value}` : (labels[value] || value);
      await updateSession(ctx.userId, "engelli_select", { disability_features: added });
      await sendButtons(ctx.phone, `✅ ${labels[value] || value} eklendi. Başka?`, [
        { id: "mulkekle:engelli:bitmis", title: "Bitir" },
        { id: `mulkekle:engelli:menu:${pageArg}`, title: "Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ ULAŞIM (tekrarlı seçim) ═══

  if (field === "transport") {
    const labels = buildLabels(TRANSPORT_ITEMS);
    if (value === "sayfa" || value === "menu") {
      const sections = buildFeatureSections(TRANSPORT_ITEMS, "mulkekle:transport", "Ulaşım", pageArg);
      await sendList(ctx.phone, "🚌 Ulaşım seçin:", "Ulaşım Seç", sections);
      return;
    }
    if (value === "bitmis") {
      // Move to açıklama
      await updateSession(ctx.userId, "desc_choice", {});
      await sendButtons(ctx.phone,
        "📝 *İlan Açıklaması*\n\nAçıklamayı nasıl eklemek istersiniz?\n\nYapay Zeka seçerseniz, girdiğiniz tüm bilgileri kullanarak etkileyici bir açıklama yazarım.",
        [
          { id: "mulkekle:desc_choice:ai", title: "🤖 Yapay Zeka Yazsın" },
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
        { id: `mulkekle:transport:menu:${pageArg}`, title: "Başka Ekle" },
      ]);
    }
    return;
  }

  // ═══ AÇIKLAMA (AI / Manuel / Geç) ═══

  if (field === "desc_choice") {
    if (value === "ai" || value === "shorter" || value === "highlight" || value === "less_detail") {
      // Generate or revise AI description
      const sess = await getSession(ctx.userId);
      const d = (sess?.data as Record<string, unknown>) || {};
      try {
        const { generatePropertyDescription } = await import("@/platform/ai/claude");
        let extraPrompt = "";
        if (value === "shorter") extraPrompt = " Daha kısa yaz, 2 paragraf yeterli.";
        else if (value === "highlight") extraPrompt = " Sadece en önemli 3-4 özelliği öne çıkar.";
        else if (value === "less_detail") extraPrompt = " Daha az detay, genel tanıtım tarzında yaz.";
        const aiDesc = await generatePropertyDescription(d, extraPrompt);
        await updateSession(ctx.userId, "ai_desc_review", { description: aiDesc, ai_description: aiDesc });
        // Send full text first, then buttons separately
        await sendText(ctx.phone, `🤖 *AI Açıklama:*\n\n${aiDesc}`);
        await sendButtons(ctx.phone, "Bu açıklamayı kullanmak ister misiniz?", [
          { id: "mulkekle:finalize:ok", title: "✅ Kullan ve Kaydet" },
          { id: "mulkekle:desc_revise:menu", title: "🔄 Değiştir" },
        ]);
      } catch (err) {
        console.error("[mulkekle:ai_desc]", err);
        await sendText(ctx.phone, "AI açıklama oluşturulamadı. Kendiniz yazın veya geçin.");
        await updateSession(ctx.userId, "description_text", {});
      }
    } else if (value === "edit_current") {
      // Show current AI description and let user send an edited version
      const sess = await getSession(ctx.userId);
      const current = ((sess?.data as Record<string, unknown>)?.ai_description || (sess?.data as Record<string, unknown>)?.description) as string || "";
      await updateSession(ctx.userId, "description_text", {});
      if (current) await sendText(ctx.phone, current);
      await sendText(ctx.phone, "✏️ Yukarıdaki metni kopyala, istediğin gibi düzenle ve bana geri gönder:");
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

  // ═══ AÇIKLAMA REVİZYON ═══

  if (field === "desc_revise") {
    if (value === "menu") {
      await sendList(ctx.phone, "🔄 Açıklamayı nasıl değiştireyim?", "Revizyon Seç", [
        { title: "Revizyon Seçenekleri", rows: [
          { id: "mulkekle:desc_choice:edit_current", title: "✏️ Bu metni düzenle" },
          { id: "mulkekle:desc_choice:shorter", title: "📏 Daha kısa yaz" },
          { id: "mulkekle:desc_choice:highlight", title: "⭐ Önemli özellikler" },
          { id: "mulkekle:desc_choice:less_detail", title: "📝 Daha az detay" },
          { id: "mulkekle:desc_choice:ai", title: "🔄 Sıfırdan yeniden yaz" },
          { id: "mulkekle:desc_choice:manual", title: "✍️ Kendim yazayım" },
        ]},
      ]);
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
  if (d.neighborhood_features) s += `📍 Muhit: ${d.neighborhood_features}\n`;
  if (d.disability_features) s += `♿ Engelliye Uygun: ${d.disability_features}\n`;
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
    heating: d.heating || null, parking: d.parking || null, facade: toArr(d.facade),
    deed_type: d.deed_type || null, housing_type: toArr(d.housing_type),
    usage_status: d.usage_status || null, swap: d.swap ?? null,
    bathroom_count: d.bathroom_count || null, kitchen_type: d.kitchen_type || null,
    elevator: d.elevator ?? null, balcony: d.balcony ?? null,
    description: d.description || null, ai_description: d.ai_description || null,
    interior_features: toArr(d.interior_features),
    exterior_features: toArr(d.exterior_features), view_features: toArr(d.view_features),
    transportation: toArr(d.transportation),
    neighborhood_features: toArr(d.neighborhood_features),
    disability_features: toArr(d.disability_features),
    status: "aktif",
  });

  await endSession(ctx.userId);

  if (error) {
    console.error("[mulkekle:finalize] DB error:", error.message, error.details, error.hint);
    await sendButtons(ctx.phone, `❌ Mülk eklenirken hata oluştu.\n\n${error.message?.substring(0, 100) || ""}`, [
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
    (location ? `\n📍 ${location}` : "") +
    `\n\n✨ Kısa süre içinde bu mülk için bir sunum hazır olacak. İstediğiniz zaman inceleyip tek linkle müşterinize gönderebilirsiniz.`,
  );

  // Discovery chain: advance if user is in guided first-use flow
  try {
    const { advanceDiscovery } = await import("@/platform/whatsapp/discovery-chain");
    await advanceDiscovery(ctx.userId, ctx.tenantKey, ctx.phone, "mulk_eklendi");
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

// ── /devam — resume mulkekle flow from last step ───────────────────────

export async function handleDevam(ctx: WaContext): Promise<void> {
  const sess = await getSession(ctx.userId);
  if (!sess) {
    await sendButtons(ctx.phone, "📭 Devam edebilecek aktif bir görev yok.\n\nAna menüden bir komut seçebilirsin.", [
      { id: "cmd:menu", title: "🏠 Ana Menü" },
    ]);
    return;
  }

  // Handle onboarding/intro flow separately
  if (sess.command === "_intro") {
    await resumeIntro(ctx, sess.current_step);
    return;
  }

  if (sess.command !== "mulkekle") {
    // Other command with active session — prompt user to type the command
    await sendButtons(ctx.phone,
      `📋 Şu an *${sess.command}* akışındasın. Devam etmek için yukarıdaki son soruya cevap ver, ya da ana menüye dön.`,
      [{ id: "cmd:menu", title: "🏠 Ana Menü" }],
    );
    return;
  }

  const step = sess.current_step;
  const d = (sess.data as Record<string, unknown>) || {};
  await sendText(ctx.phone, `🔄 *Kaldığın yerden devam ediyoruz.*\n\n_Önceki bilgilerin kayıtlı; sadece şu sorudan devam et:_`);

  switch (step) {
    case "title":
      await sendText(ctx.phone, "İlan başlığını yazın:\n\nÖrnek: \"Yalıkavak Kiralık 2+1 Daire\"");
      return;
    case "price":
      await sendText(ctx.phone, "💰 Fiyatı yazın:\n\nÖrnek: 4.5M, 25 bin, 750.000");
      return;
    case "m2":
      await sendText(ctx.phone, "📐 Brüt metrekare yazın:\n\nÖrnek: 120");
      return;
    case "rooms":
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
    case "listing_type":
      await sendButtons(ctx.phone, "📋 İlan türünü seçin:", [
        { id: "mulkekle:lt:satilik", title: "🏷 Satılık" },
        { id: "mulkekle:lt:kiralik", title: "🔑 Kiralık" },
      ]);
      return;
    case "city":
      await sendText(ctx.phone, "📍 Şehir yazın:\n\nÖrnek: Muğla");
      return;
    case "district":
      await sendText(ctx.phone, "📍 İlçe yazın:\n\nÖrnek: Bodrum\n\n(\"geç\" ile atlayın)");
      return;
    case "neighborhood":
      await sendText(ctx.phone, "📍 Mahalle yazın:\n\nÖrnek: Yalıkavak, Bitez\n\n(\"geç\" ile atlayın)");
      return;
    case "net_area":
      await sendText(ctx.phone, "📐 Net metrekare yazın:\n\nÖrnek: 95\n\n(\"geç\" ile atlayın)");
      return;
    case "floor_select":
      await handleMulkEkleCallback(ctx, "mulkekle:phase:2");
      return;
    case "totalfloors_select":
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
    case "buildingage_select":
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
    case "heating_select": {
      const prev = d.heating ? `\n\n_Seçtiklerin: ${d.heating}_` : "";
      await sendList(ctx.phone, `🔥 Isınma tipi seçin (birden fazla seçebilirsiniz):${prev}`, "Isınma", [
        { title: "Isınma", rows: [
          { id: "mulkekle:heating:kombi", title: "Kombi (Doğalgaz)" },
          { id: "mulkekle:heating:merkezi", title: "Merkezi" },
          { id: "mulkekle:heating:yerden", title: "Yerden Isıtma" },
          { id: "mulkekle:heating:klima", title: "Klima" },
          { id: "mulkekle:heating:soba", title: "Soba" },
          { id: "mulkekle:heating:yok_isinma", title: "Yok" },
          { id: "mulkekle:heating:bitmis", title: "✅ Seçimi Bitir" },
        ]},
      ]);
      return;
    }
    case "parking_select":
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
    case "facade_select":
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
    case "deed_select":
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
    case "housing_select":
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
    case "usage_select":
      await sendButtons(ctx.phone, "🔑 Kullanım durumu:", [
        { id: "mulkekle:usage:bos", title: "Boş" },
        { id: "mulkekle:usage:kiracili", title: "Kiracılı" },
        { id: "mulkekle:usage:mulk_sahibi", title: "Mülk Sahibi" },
      ]);
      return;
    case "swap_select":
      await sendButtons(ctx.phone, "🔄 Takas kabul edilir mi?", [
        { id: "mulkekle:swap:evet", title: "Evet" },
        { id: "mulkekle:swap:hayir", title: "Hayır" },
        { id: "mulkekle:swap:belirtme", title: "Belirtme" },
      ]);
      return;
    case "bathroom_select":
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
    case "kitchen_select":
      await sendButtons(ctx.phone, "🍳 Mutfak tipi:", [
        { id: "mulkekle:kitchen:acik_amerikan", title: "Açık (Amerikan)" },
        { id: "mulkekle:kitchen:kapali", title: "Kapalı" },
      ]);
      return;
    case "elevator_select":
      await sendButtons(ctx.phone, "🛗 Asansör var mı?", [
        { id: "mulkekle:elevator:evet", title: "Evet" },
        { id: "mulkekle:elevator:hayir", title: "Hayır" },
      ]);
      return;
    case "balcony_select":
      await sendButtons(ctx.phone, "🏠 Balkon var mı?", [
        { id: "mulkekle:balcony:evet", title: "Evet" },
        { id: "mulkekle:balcony:hayir", title: "Hayır" },
      ]);
      return;
    case "int_features_select": {
      const prev = d.interior_features ? `\n\n_Seçtiklerin: ${d.interior_features}_` : "";
      const sections = buildFeatureSections(INTFEAT_ITEMS, "mulkekle:intfeat", "İç Özellikler");
      await sendList(ctx.phone, `🏷 İç özellik seçin:${prev}`, "Özellik Seç", sections);
      return;
    }
    case "ext_features_select": {
      const prev = d.exterior_features ? `\n\n_Seçtiklerin: ${d.exterior_features}_` : "";
      const sections = buildFeatureSections(EXTFEAT_ITEMS, "mulkekle:extfeat", "Dış Özellikler");
      await sendList(ctx.phone, `🌿 Dış özellik seçin:${prev}`, "Özellik Seç", sections);
      return;
    }
    case "view_select": {
      const prev = d.view_features ? `\n\n_Seçtiklerin: ${d.view_features}_` : "";
      const sections = buildFeatureSections(VIEWFEAT_ITEMS, "mulkekle:viewfeat", "Manzara");
      await sendList(ctx.phone, `🏔 Manzara seçin:${prev}`, "Manzara Seç", sections);
      return;
    }
    case "muhit_select": {
      const prev = d.neighborhood_features ? `\n\n_Seçtiklerin: ${d.neighborhood_features}_` : "";
      const sections = buildFeatureSections(MUHIT_ITEMS, "mulkekle:muhit", "Muhit");
      await sendList(ctx.phone, `📍 Muhit / Çevre seçin:${prev}`, "Muhit Seç", sections);
      return;
    }
    case "engelli_select": {
      const prev = d.disability_features ? `\n\n_Seçtiklerin: ${d.disability_features}_` : "";
      const sections = buildFeatureSections(ENGELLI_ITEMS, "mulkekle:engelli", "Engelliye Uygun");
      await sendList(ctx.phone, `♿ Engelliye uygun özellik seçin:${prev}`, "Engelli Seç", sections);
      return;
    }
    case "transport_select": {
      const prev = d.transportation ? `\n\n_Seçtiklerin: ${d.transportation}_` : "";
      const sections = buildFeatureSections(TRANSPORT_ITEMS, "mulkekle:transport", "Ulaşım");
      await sendList(ctx.phone, `🚌 Ulaşım seçin:${prev}`, "Ulaşım Seç", sections);
      return;
    }
    case "desc_choice":
      await sendButtons(ctx.phone,
        "📝 *İlan Açıklaması*\n\nAçıklamayı nasıl eklemek istersiniz?",
        [
          { id: "mulkekle:desc_choice:ai", title: "🤖 Yapay Zeka Yazsın" },
          { id: "mulkekle:desc_choice:manual", title: "✍️ Kendim Yazayım" },
          { id: "mulkekle:desc_choice:skip", title: "⏭ Geç" },
        ],
      );
      return;
    case "description_text":
      await sendText(ctx.phone, "✍️ Açıklamayı yazın:");
      return;
    case "ai_desc_review":
    case "finalize_ready":
      await sendButtons(ctx.phone, "Devam etmek için /mulkekle yazabilir veya bitir.", [
        { id: "mulkekle:finalize:ok", title: "✅ Bitir & Kaydet" },
      ]);
      return;
    default:
      await sendText(ctx.phone, `⚠️ Bu adımdan devam edilemiyor (${step}). /mulkekle yazıp baştan başla.`);
      return;
  }
}

async function resumeIntro(ctx: WaContext, step: string): Promise<void> {
  if (step === "region") {
    const { startIntro } = await import("@/platform/whatsapp/intro");
    await startIntro(ctx);
    return;
  }
  if (step === "type") {
    await sendList(ctx.phone, "Hangi mülk tipini görmek istersiniz?", "Tip Seç", [{
      title: "Mülk Tipleri",
      rows: [
        { id: "vf:type:villa", title: "Villa" },
        { id: "vf:type:daire", title: "Daire" },
        { id: "vf:type:arsa", title: "Arsa" },
        { id: "vf:type:mustakil", title: "Müstakil Ev" },
        { id: "vf:type:rezidans", title: "Rezidans" },
        { id: "vf:type:dukkan", title: "Dükkan" },
        { id: "vf:type:buro_ofis", title: "Büro / Ofis" },
        { id: "vf:type:hepsi", title: "Hepsi" },
      ],
    }]);
    return;
  }
  if (step === "listing") {
    await sendButtons(ctx.phone, "Satılık mı, kiralık mı?", [
      { id: "vf:listing:satilik", title: "Satılık" },
      { id: "vf:listing:kiralik", title: "Kiralık" },
      { id: "vf:listing:hepsi", title: "Hepsi" },
    ]);
    return;
  }
  if (step === "listed") {
    await sendButtons(ctx.phone, "Kimin ilanlarını görelim?", [
      { id: "vf:listed:sahibi", title: "Sahibinden" },
      { id: "vf:listed:emlakci", title: "Emlak Ofisinden" },
      { id: "vf:listed:hepsi", title: "Hepsi" },
    ]);
    return;
  }
  await sendButtons(ctx.phone, "Tanışma akışındasın ama bu adım tanınmadı. Ana menüden devam edebilirsin.", [
    { id: "cmd:menu", title: "🏠 Ana Menü" },
  ]);
}

function toArr(v: unknown): string[] | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const arr = s.split(",").map(x => x.trim()).filter(Boolean);
  return arr.length > 0 ? arr : null;
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/TL/gi, "").replace(/-/g, "").trim();
  const mMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*(?:M|milyon)$/i);
  if (mMatch) return Math.round(parseFloat(mMatch[1].replace(",", ".")) * 1_000_000);
  const binMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)\s*bin$/i);
  if (binMatch) return Math.round(parseFloat(binMatch[1].replace(",", ".")) * 1_000);
  const num = parseInt(cleaned.replace(/[.\s]/g, "").replace(",", ""), 10);
  return isNaN(num) ? null : num;
}
