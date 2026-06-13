/**
 * /api/otel-panel/agent-mock-seed — Pilot test için mock yorum/bilgi seed
 * (Faz 5)
 *
 * Sahibi "AI'ı test edeyim" demek için bu endpoint'i çağırır → 5 mock
 * Google yorumu + 3 örnek bilgi bankası kaydı oluşur.
 *
 * Çağrı: POST { token? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";
import { resolveTenantProfile } from "@/platform/auth/tenant-profile";

export const dynamic = "force-dynamic";

const MOCK_REVIEWS = [
  {
    author_name: "Ayşe K.",
    rating: 5,
    language: "tr",
    review_text: "Harika bir tatildi. Personel çok ilgili, deniz manzaralı odamız tertemizdi. Kahvaltı çok zengin. Mutlaka tekrar geleceğiz.",
  },
  {
    author_name: "Mehmet D.",
    rating: 4,
    language: "tr",
    review_text: "Konum mükemmel, plaja yakın. Ancak klimam ilk gün çalışmadı, ertesi gün hemen tamir ettiler. Genel olarak memnun kaldık.",
  },
  {
    author_name: "John P.",
    rating: 5,
    language: "en",
    review_text: "Wonderful family pension. The owners are very friendly and helpful. Quiet location, perfect for a relaxing vacation. Will recommend!",
  },
  {
    author_name: "Sevgi B.",
    rating: 2,
    language: "tr",
    review_text: "Odamız bekleneden küçüktü, fotoğraflara aldanmayın. Ancak personel kibar ve kahvaltı iyiydi. 3 yıldız yerine 2 verdiim.",
  },
  {
    author_name: "Anna S.",
    rating: 5,
    language: "en",
    review_text: "Perfect location near the beach, amazing breakfast, and the staff went above and beyond to make us feel welcome. The room was spotless.",
  },
];

const MOCK_KNOWLEDGE = [
  { category: "general",   title: "Otelimiz hakkında", content: "12 odalı butik aile pansiyonu. 25 yıldır işletiyoruz. Misafir memnuniyeti her şeyden önemli.", sort_order: 10 },
  { category: "rules",     title: "Check-in / Check-out", content: "Check-in: 14:00 sonrası. Check-out: 11:00. Erken check-in/geç check-out için talep edin, odanın doluluğuna göre değerlendirilir.", sort_order: 20 },
  { category: "amenities", title: "Kahvaltı", content: "07:30 - 10:30 arası açık büfe. Vejetaryen, glütensiz seçenekler hazır. Erken ayrılış halinde paket kahvaltı yapabiliyoruz.", sort_order: 30 },
];

export async function POST(req: NextRequest) {
  const body: any = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const lookup = await resolveTenantProfile<{ id: string }>(sb, {
    userId: auth.userId, tenantKey: "otel", select: "id",
  });
  if ("error" in lookup) return NextResponse.json({ error: lookup.error }, { status: lookup.status });

  const { data: ouh } = await sb
    .from("otel_user_hotels")
    .select("hotel_id")
    .eq("user_id", lookup.profile.id)
    .limit(1)
    .maybeSingle();
  if (!ouh?.hotel_id) return NextResponse.json({ error: "Otel atanmamış" }, { status: 403 });
  const hotelId = ouh.hotel_id;

  // Sadece bu otel için mock yorum YOKSA seed yap (idempotent)
  const { count: existingMockReviews } = await sb
    .from("otel_external_reviews")
    .select("*", { count: "exact", head: true })
    .eq("hotel_id", hotelId)
    .eq("is_mock", true);

  let reviewsInserted = 0;
  if ((existingMockReviews || 0) === 0) {
    const rows = MOCK_REVIEWS.map((m, i) => ({
      hotel_id: hotelId,
      platform: "google",
      author_name: m.author_name,
      rating: m.rating,
      language: m.language,
      review_text: m.review_text,
      review_at: new Date(Date.now() - i * 86400000 * 3).toISOString(),
      reply_status: "unanswered",
      is_mock: true,
    }));
    const { error } = await sb.from("otel_external_reviews").insert(rows);
    if (!error) reviewsInserted = rows.length;
  }

  // Bilgi bankası seed (yine sadece boşsa)
  const { count: existingKnowledge } = await sb
    .from("otel_agent_knowledge")
    .select("*", { count: "exact", head: true })
    .eq("hotel_id", hotelId);

  let knowledgeInserted = 0;
  if ((existingKnowledge || 0) === 0) {
    const rows = MOCK_KNOWLEDGE.map(k => ({ ...k, hotel_id: hotelId, is_active: true }));
    const { error } = await sb.from("otel_agent_knowledge").insert(rows);
    if (!error) knowledgeInserted = rows.length;
  }

  if (auth.magicTokenId) {
    await sb.from("magic_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", auth.magicTokenId);
  }

  return NextResponse.json({
    success: true,
    reviews_inserted: reviewsInserted,
    knowledge_inserted: knowledgeInserted,
    message: reviewsInserted === 0 && knowledgeInserted === 0
      ? "Mock veri zaten mevcut, ek seed yapılmadı."
      : `Seed başarılı: ${reviewsInserted} yorum + ${knowledgeInserted} bilgi.`,
  });
}
