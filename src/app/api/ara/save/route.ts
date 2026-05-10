/**
 * /api/ara/save — DEMO ARAMA (query-only).
 *
 * Kullanıcı intro akışında form doldurur → bu endpoint bugünün
 * emlak_daily_leads'ını formdaki kriterlere göre süzer, uyan ilanları
 * döner. KAYDETME YOK — sadece gösterim amaçlı.
 *
 * İlk aramadan sonra kullanıcıya WA'dan "şimdi kalıcı takip kuralım"
 * followup mesajı tetikleniyor (idempotent: profile.metadata.demo_shown
 * flag ile).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

interface SearchPayload {
  token?: string;
  listing_type?: string;
  property_types?: string[];
  price_min?: number | null;
  price_max?: number | null;
  rooms?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SearchPayload;
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const supabase = getServiceClient();
    const userId = auth.userId;

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_phone, metadata")
      .eq("id", userId)
      .single();
    const userPhone = profile?.whatsapp_phone as string | undefined;

    // Query today's daily_leads matching form criteria
    const today = new Date().toISOString().slice(0, 10);
    let query = supabase.from("emlak_daily_leads")
      .select("source_id, source_url, title, type, listing_type, price, area, rooms, location_neighborhood")
      .eq("snapshot_date", today)
      .ilike("location_district", "%Bodrum%");

    if (body.listing_type) query = query.eq("listing_type", body.listing_type);
    if (body.property_types && body.property_types.length > 0) {
      query = query.in("type", body.property_types);
    }
    if (body.price_min) query = query.gte("price", body.price_min);
    if (body.price_max) query = query.lte("price", body.price_max);
    if (body.rooms && body.rooms.length > 0) {
      query = query.in("rooms", body.rooms);
    }

    const { data: results } = await query.order("created_at", { ascending: false }).limit(50);

    // Free-ride pattern (2026-05-06): tour transition kaldırıldı.
    // Eski "Takip Kur" otomatik push'u silindi — kullanıcı arama sonucunu
    // görür, kendi inisiyatifiyle Panel'den İlan Takip'e geçer.

    return NextResponse.json({
      success: true,
      results: results || [],
    });
  } catch (err) {
    console.error("[ara:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
