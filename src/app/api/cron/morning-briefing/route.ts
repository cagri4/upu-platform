import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Auth check
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  let sent = 0;

  try {
    // Get users with briefing enabled
    const { data: users } = await supabase
      .from("profiles")
      .select("id, whatsapp_phone, tenant_id")
      .not("whatsapp_phone", "is", null)
      .eq("metadata->>briefing_enabled", "true");

    if (!users?.length) {
      return NextResponse.json({ ok: true, sent: 0, message: "No users with briefing enabled" });
    }

    // Get emlak tenant IDs
    const { data: emlakTenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("tenant_key", "emlak");

    const emlakTenantIds = new Set((emlakTenants || []).map((t) => t.id));

    for (const user of users) {
      // Only process emlak tenant users for now
      if (!emlakTenantIds.has(user.tenant_id)) continue;

      try {
        // Count properties by listing type
        const { count: totalProps } = await supabase
          .from("emlak_properties")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        const { count: satilikCount } = await supabase
          .from("emlak_properties")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("listing_type", "satilik");

        const { count: kiralikCount } = await supabase
          .from("emlak_properties")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("listing_type", "kiralik");

        // Count active customers
        const { count: customerCount } = await supabase
          .from("emlak_customers")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "aktif");

        // Count pending reminders (next 24h)
        const tomorrow = new Date();
        tomorrow.setHours(tomorrow.getHours() + 24);
        const { count: reminderCount } = await supabase
          .from("reminders")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("triggered", false)
          .lte("remind_at", tomorrow.toISOString());

        // Count contracts expiring in 7 days
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const { count: contractCount } = await supabase
          .from("contracts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .neq("status", "cancelled")
          .gte("end_date", new Date().toISOString().split("T")[0])
          .lte("end_date", nextWeek.toISOString().split("T")[0]);

        const message =
          `\u{1F4CA} Gunaydin! Gunluk brifing:\n\n` +
          `\u{1F3E0} Portfoly: ${totalProps || 0} mulk (${satilikCount || 0} satilik, ${kiralikCount || 0} kiralik)\n` +
          `\u{1F465} Musteriler: ${customerCount || 0} aktif\n` +
          `\u23F0 Bugunku hatirlatmalar: ${reminderCount || 0}\n` +
          `\u{1F4CB} Yaklasan sozlesme: ${contractCount || 0} (7 gun icinde)\n\n` +
          `Iyi calismalar!`;

        await sendText(user.whatsapp_phone, message);
        sent++;
      } catch (err) {
        console.error(`[cron:morning-briefing] Error for user ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[cron:morning-briefing] Fatal error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent });
}
