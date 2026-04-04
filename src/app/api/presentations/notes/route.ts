import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export async function POST(req: NextRequest) {
  const { token, notes, customer_reaction, interested_property, next_step, sale_status } = await req.json();

  if (!token || !notes) {
    return NextResponse.json({ error: "token ve notes gerekli" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: pres } = await supabase
    .from("emlak_presentations")
    .select("id")
    .eq("magic_token", token)
    .single();

  if (!pres) {
    return NextResponse.json({ error: "Sunum bulunamadı" }, { status: 404 });
  }

  const { error } = await supabase
    .from("emlak_presentations")
    .update({
      feedback_text: notes,
      feedback_score: customer_reaction || null,
      follow_up_status: next_step || sale_status || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pres.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also update with metadata in a separate column-safe way
  const metadata: Record<string, unknown> = {};
  if (interested_property) metadata.interested_property = interested_property;
  if (sale_status) metadata.sale_status = sale_status;
  if (next_step) metadata.next_step = next_step;
  if (customer_reaction) metadata.customer_reaction = customer_reaction;

  if (Object.keys(metadata).length > 0) {
    // Store extra metadata in follow_up_status as JSON string
    await supabase
      .from("emlak_presentations")
      .update({
        follow_up_status: JSON.stringify(metadata),
      })
      .eq("id", pres.id);
  }

  return NextResponse.json({ ok: true });
}
