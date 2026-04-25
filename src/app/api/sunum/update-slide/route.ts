/**
 * /api/sunum/update-slide — bir slaytın metnini günceller.
 *
 * slide_key formatları:
 * - "ai:0", "ai:1", "ai:2" → ai_summary'nin ilgili paragrafı
 * - "cover" → property başlığı
 * - "property" → property açıklaması (slide 2)
 *
 * POST { token, slide_key, text }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface PresContent {
  customer?: Record<string, unknown>;
  properties?: Array<{ title?: string; description?: string | null; [k: string]: unknown }>;
  ai_summary?: string;
  ai_chunks_override?: string[];
  created_at?: string;
  first_seen_at?: string | null;
  deleted_slides?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token as string;
    const slideKey = body.slide_key as string;
    const text = (body.text as string)?.toString() || "";

    if (!token || !slideKey) {
      return NextResponse.json({ error: "Token ve slide_key gerekli." }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: pres } = await supabase
      .from("emlak_presentations")
      .select("id, content")
      .eq("magic_token", token)
      .single();

    if (!pres) return NextResponse.json({ error: "Sunum bulunamadı." }, { status: 404 });

    const content: PresContent = (pres.content as PresContent) || {};
    const properties = [...(content.properties || [])];

    if (slideKey.startsWith("ai:")) {
      const idx = parseInt(slideKey.split(":")[1], 10);
      if (Number.isNaN(idx) || idx < 0 || idx > 2) {
        return NextResponse.json({ error: "Geçersiz slayt." }, { status: 400 });
      }
      const chunks = content.ai_chunks_override
        || splitDefault(content.ai_summary || "", 3);
      while (chunks.length < 3) chunks.push("");
      chunks[idx] = text;
      content.ai_chunks_override = chunks;
    } else if (slideKey === "cover") {
      if (properties[0]) {
        properties[0].title = text;
      }
    } else if (slideKey === "property") {
      if (properties[0]) {
        properties[0].description = text;
      }
    } else {
      return NextResponse.json({ error: "Tanınmayan slayt." }, { status: 400 });
    }

    const newContent = { ...content, properties };

    const { error } = await supabase.from("emlak_presentations")
      .update({ content: newContent })
      .eq("id", pres.id);

    if (error) {
      console.error("[sunum:update-slide]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[sunum:update-slide]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}

function splitDefault(text: string, n: number): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];
  if (paragraphs.length <= n) return paragraphs;
  const per = Math.ceil(paragraphs.length / n);
  const chunks: string[] = [];
  for (let i = 0; i < n; i++) {
    const slice = paragraphs.slice(i * per, (i + 1) * per).join("\n\n");
    if (slice) chunks.push(slice);
  }
  return chunks;
}
