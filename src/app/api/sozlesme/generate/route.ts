/**
 * /api/sozlesme/generate — Anthropic Claude ile sözleşme metni üret.
 *
 * POST { token, property_id, customer_id, commission, duration, exclusive }
 * → { generated_text: string }  veya  { error: string }
 *
 * Rate limit: kullanıcı başına son 60 sn'de max 3 üretim (basit DB sayaç).
 * Token + ~2000 input + ~1500 output ≈ Haiku ile cents-altı maliyet.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { askClaude } from "@/platform/ai/claude";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT =
  "Sen Türkiye emlak hukuku ve TBK (Türk Borçlar Kanunu) uyumlu sözleşme metni hazırlayan bir asistansın. " +
  "KVKK kişisel veri ilkelerine uygun yazıyorsun. Sözleşmeyi resmi, açık ve okunaklı Türkçe ile hazırla. " +
  "Format:\n" +
  "1. BAŞLIK (büyük harf)\n" +
  "2. TARAFLAR (Mal Sahibi / Vekil-Aracı / Kiracı/Alıcı — uygun şekilde)\n" +
  "3. SÖZLEŞMENİN KONUSU (mülk detayları)\n" +
  "4. BEDEL VE ÖDEME ŞARTLARI\n" +
  "5. KOMİSYON / SÜRE / MÜNHASIRLIK\n" +
  "6. CAYMA HAKKI VE FESİH\n" +
  "7. UYUŞMAZLIK VE YETKİLİ MAHKEME\n" +
  "8. İMZA ALANLARI\n\n" +
  "Önemli: Müşteri TC numarası verilmemiş ise alanı boş bırak (___). " +
  "Tarih bilgisini bugünün tarihiyle yaz. " +
  "Mülk adresini açık şekilde yaz. " +
  "Çıktıda sadece sözleşme metni; ek açıklama veya yorum YAZMA. Markdown başlıkları (## ile) kullanabilirsin.";

const DISCLAIMER =
  "\n\n---\n\n" +
  "*Bu sözleşme yapay zeka tarafından oluşturulmuş bir taslaktır. Hukuki bağlayıcılık ve özel durumlarınız için bir avukatla görüşmeniz önerilir. UPU Dev sözleşmenin hukuki uygunluğundan sorumlu değildir.*";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { property_id, customer_id, commission, duration, exclusive } = body || {};

    if (!property_id || !customer_id) {
      return NextResponse.json({ error: "Mülk ve müşteri seçimi zorunlu." }, { status: 400 });
    }

    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = getServiceClient();
    const userId = auth.userId;

    // Mülk + müşteri çek (kullanıcıya ait olmalı)
    const [propRes, custRes, profileRes] = await Promise.all([
      sb.from("emlak_properties")
        .select("title, listing_type, type, price, area, rooms, location_city, location_district, location_neighborhood, description")
        .eq("id", property_id).eq("user_id", userId).maybeSingle(),
      sb.from("emlak_customers")
        .select("name, phone, email")
        .eq("id", customer_id).eq("user_id", userId).maybeSingle(),
      sb.from("profiles")
        .select("display_name, metadata")
        .eq("id", userId).single(),
    ]);

    if (!propRes.data) return NextResponse.json({ error: "Mülk bulunamadı." }, { status: 404 });
    if (!custRes.data) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });

    const prop = propRes.data;
    const cust = custRes.data;
    const agentMeta = (profileRes.data?.metadata as Record<string, unknown> | null) || {};
    const agentProfile = agentMeta.agent_profile as { office_name?: string; full_name?: string } | undefined;
    const agentName = agentProfile?.full_name || profileRes.data?.display_name || "Emlak Danışmanı";
    const officeName = agentProfile?.office_name || "—";

    const propAddress = [prop.location_neighborhood, prop.location_district, prop.location_city]
      .filter(Boolean).join(", ");

    const lt = prop.listing_type === "kiralik" ? "Kira" : "Satış";
    const today = new Date().toLocaleDateString("tr-TR");

    const userMessage =
      `Sözleşme tipi: Yetkilendirme (${lt}) Sözleşmesi\n` +
      `Tarih: ${today}\n\n` +
      `MAL SAHİBİ (Müvekkil):\n` +
      `Ad Soyad: ${cust.name}\n` +
      `Telefon: ${cust.phone || "—"}\n` +
      `E-posta: ${cust.email || "—"}\n\n` +
      `EMLAK DANIŞMANI (Vekil):\n` +
      `Ad Soyad: ${agentName}\n` +
      `Ofis: ${officeName}\n\n` +
      `MÜLK BİLGİLERİ:\n` +
      `Başlık: ${prop.title || "—"}\n` +
      `Tip: ${prop.type || "—"}\n` +
      `Adres: ${propAddress || "—"}\n` +
      `${prop.rooms ? `Oda: ${prop.rooms}\n` : ""}` +
      `${prop.area ? `Alan: ${prop.area} m²\n` : ""}` +
      `${prop.price ? `Bedel: ${new Intl.NumberFormat("tr-TR").format(prop.price)} TL\n` : ""}` +
      `${prop.description ? `Açıklama: ${prop.description}\n` : ""}\n` +
      `SÖZLEŞME PARAMETRELERİ:\n` +
      `Komisyon: %${Number(commission) || 2} + KDV\n` +
      `Süre: ${Number(duration) || 3} ay\n` +
      `Münhasırlık: ${exclusive ? "Evet (münhasır yetki)" : "Hayır (paylaşımlı)"}\n\n` +
      `Bu bilgilerle resmi bir Yetkilendirme Sözleşmesi metni hazırla.`;

    const generated = await askClaude(SYSTEM_PROMPT, userMessage, 2000);

    if (!generated || generated.length < 100) {
      return NextResponse.json({
        error: "AI üretim şu an mevcut değil, lütfen daha sonra tekrar deneyin.",
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      generated_text: generated + DISCLAIMER,
    });
  } catch (err) {
    console.error("[sozlesme:generate]", err);
    return NextResponse.json({
      error: "AI üretim sırasında hata oluştu, lütfen tekrar deneyin.",
    }, { status: 500 });
  }
}
