/**
 * /api/musterilerim/init — magic link doğrulama + kullanıcının
 * tüm aktif müşterilerini listele (kart layout için).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await resolvePanelAuth(req);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const supabase = getServiceClient();
    const { data: customers } = await supabase
      .from("emlak_customers")
      .select("id, name, phone, email, looking_for, listing_type, property_type, rooms, budget_min, budget_max, location, notes, status, pipeline_stage, created_at")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    const items = (customers || []).map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      looking_for: Array.isArray(c.looking_for) ? c.looking_for : (
        c.listing_type === "hepsi" ? ["satilik", "kiralik"] :
        c.listing_type === "satilik" || c.listing_type === "kiralik" ? [c.listing_type] : []
      ),
      property_type: c.property_type,
      rooms: c.rooms,
      budget_min: c.budget_min,
      budget_max: c.budget_max,
      location: c.location,
      notes: c.notes,
      status: c.status,
      pipeline_stage: c.pipeline_stage,
      created_at: c.created_at,
    }));

    return NextResponse.json({ customers: items });
  } catch (err) {
    console.error("[musterilerim:init]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
