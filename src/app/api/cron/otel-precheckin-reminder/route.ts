/**
 * Cron — T-24h online check-in hatırlatması
 *
 * Yarın check-in olacak misafirlere mekik link gönderir. Tek-koşul:
 * pre_checkin_complete = false. Misafir profili (guest_profile_id) zorunlu.
 *
 * Vercel cron schedule: günlük 14:00 TRT (10:00 UTC) — yaklaşan check-in'in
 * yaklaşık 24h öncesi.
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendUrlButton } from "@/platform/whatsapp/send";
import { generateCekinToken } from "@/tenants/otel/commands/cekin";
import { getTenantByKey } from "@/tenants/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Yarın
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);

  let sent = 0;
  let skipped = 0;

  try {
    const { data: rezs } = await supabase
      .from("otel_reservations")
      .select("id, hotel_id, guest_profile_id, guest_name, guest_phone, check_in, pre_checkin_complete, otel_hotels(name)")
      .eq("check_in", tomorrowISO)
      .eq("pre_checkin_complete", false)
      .not("guest_profile_id", "is", null)
      .not("guest_phone", "is", null);

    if (!rezs?.length) return NextResponse.json({ ok: true, sent: 0, skipped: 0, target_date: tomorrowISO });

    const tenant = getTenantByKey("otel");
    const slug = tenant?.slug || "hotelai";

    for (const rez of rezs) {
      try {
        const token = await generateCekinToken(rez.guest_profile_id!, rez.id);
        const url = `https://${slug}.upudev.nl/tr/otel-cekin?t=${token}`;
        const hotelName = (rez.otel_hotels as unknown as { name?: string } | null)?.name || "otelimiz";

        await sendUrlButton(rez.guest_phone!,
          `🏨 *${hotelName}*\n\nMerhaba ${rez.guest_name || "değerli misafir"}!\n\nYarın geliyorsunuz — online check-in yaparsanız anahtar kartınız hazır olacak ve resepsiyonda beklemek zorunda kalmazsınız. 2 dakika sürer.`,
          "📝 Online Check-in",
          url,
          { skipNav: true },
        );
        sent++;
      } catch (err) {
        console.error(`[cron:otel-precheckin] Error for rez ${rez.id}:`, err);
        skipped++;
      }
    }
  } catch (err) {
    console.error("[cron:otel-precheckin] Fatal:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent, skipped, target_date: tomorrowISO });
}
