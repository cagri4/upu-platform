import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const supabase = getServiceClient();
  const [{ data: customer }, { data: contacts }] = await Promise.all([
    supabase.from("emlak_customers").select("*").eq("id", id).eq("user_id", userId).maybeSingle(),
    supabase.from("emlak_customer_contacts").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  if (!customer) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json({ customer, contacts: contacts || [] });
}
