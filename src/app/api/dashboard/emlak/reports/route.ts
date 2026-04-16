import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const period = req.nextUrl.searchParams.get("period") || "week"; // "week" | "month"
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = getServiceClient();
  const days = period === "month" ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: newProps },
    { count: newCusts },
    { count: contactsMade },
    { count: remindersCreated },
    { count: contractsCreated },
    { count: commandsRun },
  ] = await Promise.all([
    supabase.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase.from("emlak_customer_contacts").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase.from("reminders").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase.from("contracts").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    supabase.from("bot_activity").select("*", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
  ]);

  const { data: pipelineData } = await supabase
    .from("emlak_customers")
    .select("pipeline_stage")
    .eq("user_id", userId);

  const pipeline: Record<string, number> = {};
  for (const r of pipelineData || []) {
    const s = r.pipeline_stage || "yeni";
    pipeline[s] = (pipeline[s] || 0) + 1;
  }

  return NextResponse.json({
    period,
    days,
    since,
    counts: {
      newProps: newProps || 0,
      newCusts: newCusts || 0,
      contactsMade: contactsMade || 0,
      remindersCreated: remindersCreated || 0,
      contractsCreated: contractsCreated || 0,
      commandsRun: commandsRun || 0,
    },
    pipeline,
  });
}
