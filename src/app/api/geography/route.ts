/**
 * Turkey geography lookup.
 * GET /api/geography                  → { iller: ["ADANA", ...] }
 * GET /api/geography?il=MUĞLA         → { ilceler: ["BODRUM", ...] }
 * GET /api/geography?il=MUĞLA&ilce=BODRUM → { mahalleler: ["YALIKAVAK Mah.", ...] }
 *
 * Data source: bertugfahriozer/il_ilce_mahalle (TUIK + NVİ derived, 81 iller).
 */
import { NextRequest, NextResponse } from "next/server";
import geoData from "@/data/tr-geo.json";

export const dynamic = "force-dynamic";

type Geo = Record<string, Record<string, string[]>>;
const GEO = geoData as Geo;

function norm(s: string): string {
  return s.toLocaleUpperCase("tr-TR").trim();
}

export async function GET(req: NextRequest) {
  const il = req.nextUrl.searchParams.get("il");
  const ilce = req.nextUrl.searchParams.get("ilce");

  if (!il) {
    // return all iller sorted
    return NextResponse.json({ iller: Object.keys(GEO).sort((a, b) => a.localeCompare(b, "tr")) });
  }
  const ilKey = norm(il);
  const iller = Object.keys(GEO);
  const matchedIl = iller.find(k => norm(k) === ilKey);
  if (!matchedIl) return NextResponse.json({ error: "İl bulunamadı" }, { status: 404 });

  if (!ilce) {
    return NextResponse.json({ ilceler: Object.keys(GEO[matchedIl]).sort((a, b) => a.localeCompare(b, "tr")) });
  }
  const ilceKey = norm(ilce);
  const ilceler = Object.keys(GEO[matchedIl]);
  const matchedIlce = ilceler.find(k => norm(k) === ilceKey);
  if (!matchedIlce) return NextResponse.json({ error: "İlçe bulunamadı" }, { status: 404 });

  return NextResponse.json({ mahalleler: GEO[matchedIl][matchedIlce].slice().sort((a, b) => a.localeCompare(b, "tr")) });
}
