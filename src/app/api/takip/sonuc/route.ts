/**
 * /api/takip/sonuc?id=<takip_id>&t=<token>
 * Bir takibin kriterlerine uyan son 24 saatlik (bugünün) sahibi ilanları döner.
 * Cron'un (tenant-briefings.ts) match logic'iyle aynı filtre uygulanır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

interface DailyLead {
  source_id: string;
  source_url: string;
  title: string;
  type: string;
  listing_type: string;
  price: number | null;
  area: number | null;
  rooms: string | null;
  location_neighborhood: string | null;
}

interface Criteria {
  neighborhoods: string[];
  property_types: string[];
  listing_type: string | null;
  price_min: number | null;
  price_max: number | null;
}

function matchesCriteria(lead: DailyLead, c: Criteria): boolean {
  if (c.property_types.length > 0 && !c.property_types.includes(lead.type)) return false;
  if (c.listing_type && lead.listing_type !== c.listing_type) return false;
  if (c.price_min && (lead.price || 0) < c.price_min) return false;
  if (c.price_max && (lead.price || 0) > c.price_max) return false;
  if (c.neighborhoods.length > 0) {
    const loc = (lead.location_neighborhood || "").toLocaleLowerCase("tr-TR");
    const match = c.neighborhoods.some(n => loc.includes(n.toLocaleLowerCase("tr-TR")));
    if (!match) return false;
  }
  return true;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
  const id = req.nextUrl.searchParams.get("id");
  if (!token || !id) return NextResponse.json({ error: "Token ve id gerekli." }, { status: 400 });

  const sb = getServiceClient();
  const { data: pt } = await sb
    .from("magic_link_tokens")
    .select("user_id, expires_at")
    .eq("token", token).maybeSingle();
  if (!pt) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
  if (new Date(pt.expires_at) < new Date()) {
    return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
  }

  // Takip kriteri (kullanıcıya ait olmalı)
  const { data: takip } = await sb
    .from("emlak_tracking_criteria")
    .select("name, neighborhoods, property_types, listing_type, price_min, price_max")
    .eq("id", id)
    .eq("user_id", pt.user_id)
    .maybeSingle();
  if (!takip) return NextResponse.json({ error: "Takip bulunamadı." }, { status: 404 });

  // Bugünün Bodrum leads'i (cron pattern: snapshot_date = today, ilike Bodrum)
  const today = new Date().toISOString().slice(0, 10);
  const { data: leadsRaw } = await sb
    .from("emlak_daily_leads")
    .select("source_id, source_url, title, type, listing_type, price, area, rooms, location_neighborhood")
    .eq("snapshot_date", today)
    .ilike("location_district", "%Bodrum%")
    .order("created_at", { ascending: false });

  const leads = (leadsRaw || []) as DailyLead[];
  const criteria: Criteria = {
    neighborhoods: (takip.neighborhoods as string[]) || [],
    property_types: (takip.property_types as string[]) || [],
    listing_type: (takip.listing_type as string | null) || null,
    price_min: (takip.price_min as number | null) || null,
    price_max: (takip.price_max as number | null) || null,
  };

  const matching = leads.filter(l => matchesCriteria(l, criteria));

  return NextResponse.json({
    success: true,
    name: takip.name,
    total_today: leads.length,
    matched: matching.length,
    leads: matching.slice(0, 30), // panel UI için cap 30
  });
}
