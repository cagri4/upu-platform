import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolveUserId } from "../../auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const { propertyId } = await params;
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = await resolveUserId(token);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getServiceClient();

  const { data: property } = await supabase
    .from("emlak_properties")
    .select("*")
    .eq("id", propertyId)
    .eq("user_id", userId)
    .single();

  if (!property) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: photos } = await supabase
    .from("emlak_property_photos")
    .select("url, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order");

  const p = property as Record<string, unknown>;

  // Convert boolean Var/Yok-style fields to the labels sahibinden's
  // form selects use, so the extension's fillSelect can match them.
  const boolToVarYok = (v: unknown): string | null => {
    if (v === true) return "Var";
    if (v === false) return "Yok";
    return null;
  };
  const boolToEvetHayir = (v: unknown): string | null => {
    if (v === true) return "Evet";
    if (v === false) return "Hayır";
    return null;
  };

  // Multi-select feature columns may be stored as comma-separated strings
  // (legacy WhatsApp free-text input). The Chrome extension's clickCb
  // expects an array — split + trim if needed.
  const toArray = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean).map(String);
    if (typeof v === "string") {
      return v.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  const formData: Record<string, unknown> = {
    title: p.title,
    price: p.price,
    area_gross: p.area,
    area_net: p.net_area || (p.area ? Math.round((p.area as number) * 0.8) : null),
    rooms: p.rooms,
    building_age: p.building_age,
    floor: p.floor,
    total_floors: p.total_floors,
    location_city: p.location_city,
    location_district: p.location_district,
    location_neighborhood: p.location_neighborhood,
    description: p.description,
    features: toArray(p.features),
    heating: p.heating,
    bathroom: p.bathroom_count,
    kitchen: p.kitchen_type,
    balcony: boolToVarYok(p.balcony),
    elevator: boolToVarYok(p.elevator),
    parking: p.parking,
    usage: p.usage_status,
    deed: p.deed_type,
    swap: boolToEvetHayir(p.swap),
    facade: p.facade ? (Array.isArray(p.facade) ? p.facade : [p.facade]) : [],
    konut_tipi: p.housing_type ? (Array.isArray(p.housing_type) ? p.housing_type : [p.housing_type]) : [],
    ic_ozellikler: toArray(p.interior_features),
    dis_ozellikler: toArray(p.exterior_features),
    muhit: toArray(p.neighborhood_features),
    ulasim: toArray(p.transportation),
    manzara: toArray(p.view_features),
    engelli_piyon: toArray(p.disability_features),
  };

  return NextResponse.json({ formData, photos: (photos || []).map(ph => ph.url) });
}
