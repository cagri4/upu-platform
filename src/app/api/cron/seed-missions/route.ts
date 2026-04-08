/**
 * Seed missions — run once to populate platform_missions table
 */
import { NextResponse } from "next/server";
import { seedEmlakMissions } from "@/tenants/emlak/gamification";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const emlakCount = await seedEmlakMissions();
    return NextResponse.json({ seeded: { emlak: emlakCount } });
  } catch (err) {
    console.error("[seed-missions]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
