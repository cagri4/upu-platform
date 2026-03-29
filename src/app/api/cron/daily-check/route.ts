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
  let contractAlerts = 0;
  let cooldownAlerts = 0;

  try {
    // ── A) Contract expiry check ──────────────────────────────────────
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, user_id, property_title, end_date")
      .neq("status", "cancelled")
      .gte("end_date", now.toISOString().split("T")[0])
      .lte("end_date", nextWeek.toISOString().split("T")[0])
      .limit(200);

    if (contracts?.length) {
      const userIds = [...new Set(contracts.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, whatsapp_phone")
        .in("id", userIds)
        .not("whatsapp_phone", "is", null);

      const phoneMap = new Map((profiles || []).map((p) => [p.id, p.whatsapp_phone]));

      for (const contract of contracts) {
        const phone = phoneMap.get(contract.user_id);
        if (!phone) continue;

        try {
          const endDate = new Date(contract.end_date);
          const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const title = contract.property_title || "Bilinmeyen mulk";

          await sendText(
            phone,
            `\u{1F4CB} Sozlesme uyarisi: ${title} sozlesmesi ${daysLeft} gun icinde doluyor.`,
          );
          contractAlerts++;
        } catch (err) {
          console.error(`[cron:daily-check] Contract alert error for ${contract.id}:`, err);
        }
      }
    }

    // ── B) Customer cooldown check ────────────────────────────────────
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: staleCustomers } = await supabase
      .from("emlak_customers")
      .select("id, user_id, name, updated_at")
      .eq("status", "aktif")
      .lt("updated_at", fourteenDaysAgo.toISOString())
      .limit(200);

    if (staleCustomers?.length) {
      const userIds = [...new Set(staleCustomers.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, whatsapp_phone")
        .in("id", userIds)
        .not("whatsapp_phone", "is", null);

      const phoneMap = new Map((profiles || []).map((p) => [p.id, p.whatsapp_phone]));

      // Group by user to avoid spamming
      const byUser = new Map<string, typeof staleCustomers>();
      for (const customer of staleCustomers) {
        const list = byUser.get(customer.user_id) || [];
        list.push(customer);
        byUser.set(customer.user_id, list);
      }

      for (const [userId, customers] of byUser) {
        const phone = phoneMap.get(userId);
        if (!phone) continue;

        try {
          // Send max 3 customer alerts per user
          for (const customer of customers.slice(0, 3)) {
            const daysAgo = Math.floor(
              (now.getTime() - new Date(customer.updated_at).getTime()) / (1000 * 60 * 60 * 24),
            );
            await sendText(phone, `\u{1F465} ${customer.name} ile ${daysAgo} gundur iletisim yok.`);
            cooldownAlerts++;
          }
        } catch (err) {
          console.error(`[cron:daily-check] Cooldown alert error for user ${userId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[cron:daily-check] Fatal error:", err);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, contractAlerts, cooldownAlerts });
}
