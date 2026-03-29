import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Get emlak tenant IDs
    const { data: emlakTenants } = await supabase
      .from("tenants")
      .select("id")
      .eq("tenant_key", "emlak");

    const emlakTenantIds = new Set((emlakTenants || []).map((t) => t.id));

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekStart = oneWeekAgo.toISOString();

    for (const user of users) {
      if (!emlakTenantIds.has(user.tenant_id)) continue;

      try {
        // Properties added this week
        const { count: newProps } = await supabase
          .from("emlak_properties")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", weekStart);

        // Customers added this week
        const { count: newCustomers } = await supabase
          .from("emlak_customers")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", weekStart);

        // Total portfolio value
        const { data: propsForValue } = await supabase
          .from("emlak_properties")
          .select("price")
          .eq("user_id", user.id)
          .eq("status", "aktif");

        const totalValue = (propsForValue || []).reduce(
          (sum, p) => sum + (typeof p.price === "number" ? p.price : 0),
          0,
        );

        const totalProps = propsForValue?.length || 0;
        const fmtValue = new Intl.NumberFormat("tr-TR").format(totalValue);

        const message =
          `\u{1F4C8} Haftalik Rapor\n\n` +
          `\u{1F3E0} Bu hafta eklenen mulk: ${newProps || 0}\n` +
          `\u{1F465} Bu hafta eklenen musteri: ${newCustomers || 0}\n` +
          `\u{1F4BC} Toplam portfoly: ${totalProps} mulk\n` +
          `\u{1F4B0} Toplam portfoly degeri: ${fmtValue} TL\n\n` +
          `Basarili bir hafta olsun!`;

        await sendText(user.whatsapp_phone, message);
        sent++;
      } catch (err) {
        console.error(`[cron:weekly-report] Error for user ${user.id}:`, err);
      }
    }
  } catch (err) {
    console.error("[cron:weekly-report] Fatal error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent });
}
