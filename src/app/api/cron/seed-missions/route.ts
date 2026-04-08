/**
 * Seed missions — run once to populate platform_missions table
 */
import { NextResponse } from "next/server";
import { seedEmlakMissions } from "@/tenants/emlak/gamification";
import { seedBayiMissions } from "@/tenants/bayi/gamification";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const emlakCount = await seedEmlakMissions();
    const bayiCount = await seedBayiMissions();
    return NextResponse.json({ seeded: { emlak: emlakCount, bayi: bayiCount } });
  } catch (err) {
    console.error("[seed-missions]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
