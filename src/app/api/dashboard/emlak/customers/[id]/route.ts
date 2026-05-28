import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuth } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const userId = auth.userId;
  const { id } = await ctx.params;

  const supabase = getServiceClient();
  const [{ data: customer }, { data: contacts }] = await Promise.all([
    supabase.from("emlak_customers").select("*").eq("id", id).eq("user_id", userId).maybeSingle(),
    supabase.from("emlak_customer_contacts").select("*").eq("customer_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  if (!customer) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  return NextResponse.json({ customer, contacts: contacts || [] });
}
