import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

  // Test Supabase connection
  let dbOk = false;
  let userCount = 0;
  try {
    const supabase = getServiceClient();
    const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    dbOk = true;
    userCount = count || 0;
  } catch {}

  return NextResponse.json({
    wa_token_set: !!token,
    wa_token_len: token.length,
    wa_token_start: token.substring(0, 10),
    wa_phone_id: phoneId,
    wa_phone_id_len: phoneId.length,
    db_ok: dbOk,
    user_count: userCount,
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "NOT SET",
  });
}
