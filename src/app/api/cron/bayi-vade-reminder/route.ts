/**
 * GET /api/cron/bayi-vade-reminder — günlük vade hatırlatma cron'u.
 *
 * Mantık:
 *   1. bayi_invoices WHERE status='open' AND due_date BETWEEN today+0 AND today+3
 *   2. Her fatura için days_until_due hesapla (0, 1, 2, 3)
 *   3. Aynı (invoice_id, days_bucket) için zaten gönderildiyse atla
 *      (notifications.payload['invoice_id']+payload['days_bucket'] dedup)
 *   4. sendNotification type='faturalama' (free, default açık) ile WA + DB log
 *
 * Hatırlatma kademesi:
 *   D-3 → "3 gün sonra vade"
 *   D-1 → "yarın vade"
 *   D-0 → "bugün vade dolu"
 *
 * vercel.json: 09:00 UTC günlük tetiklenir (TR sabah ~12:00).
 */
import { NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendNotification } from "@/platform/notifications/send-notification";

export const dynamic = "force-dynamic";

interface InvoiceRow {
  id: string;
  tenant_id: string;
  dealer_user_id: string;
  invoice_no: string;
  due_date: string;
  amount: number;
  currency: string;
}

const REMINDER_DAYS = [0, 1, 3] as const;
type ReminderDay = (typeof REMINDER_DAYS)[number];

function bucketLabel(days: ReminderDay): { title: string; intro: string } {
  if (days === 0) return { title: "🔴 Faturanızın vadesi bugün", intro: "Bugün vade tarihi." };
  if (days === 1) return { title: "🟡 Faturanız yarın vadeli", intro: "Yarın vade tarihi." };
  return { title: "🟡 Faturanızın vadesi 3 gün sonra", intro: `${days} gün sonra vade.` };
}

function fmtTry(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: currency || "TRY",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString("tr-TR")} ${currency || "TRY"}`;
  }
}

function todayIso(): string {
  // UTC tarihi — Supabase due_date 'date' tipi, UTC tutarlı.
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(dueIso: string, baseIso: string): number {
  const due = new Date(`${dueIso}T00:00:00Z`).getTime();
  const base = new Date(`${baseIso}T00:00:00Z`).getTime();
  return Math.round((due - base) / 86400000);
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();
  const today = todayIso();
  const maxDay = Math.max(...REMINDER_DAYS);
  const horizon = addDays(today, maxDay);

  const { data: invoices, error: invErr } = await sb
    .from("bayi_invoices")
    .select("id, tenant_id, dealer_user_id, invoice_no, due_date, amount, currency")
    .eq("status", "open")
    .gte("due_date", today)
    .lte("due_date", horizon);

  if (invErr) {
    console.error("[cron:bayi-vade-reminder] query failed", invErr);
    return NextResponse.json({ error: "Query failed", details: invErr.message }, { status: 500 });
  }

  const rows = (invoices || []) as InvoiceRow[];

  // Idempotency: aynı (invoice, days_bucket) için 7 günde 1'den fazla
  // bildirim göndermeyiz. Hızlı kontrol için son 7 gün notifications'ı çek.
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const { data: recentNotifs } = await sb
    .from("notifications")
    .select("user_id, payload")
    .eq("type", "faturalama")
    .gte("created_at", sevenDaysAgo.toISOString());

  // key: `${user_id}:${invoice_id}:${days_bucket}`
  const seenKeys = new Set<string>();
  for (const n of recentNotifs || []) {
    const payload = (n.payload as Record<string, unknown> | null) || {};
    const invId = typeof payload.invoice_id === "string" ? payload.invoice_id : null;
    const bucket = payload.days_bucket;
    if (invId && bucket !== undefined && bucket !== null) {
      seenKeys.add(`${n.user_id}:${invId}:${bucket}`);
    }
  }

  const results = { scanned: rows.length, sent: 0, skipped_dedup: 0, skipped_off_bucket: 0, errors: 0 };

  for (const inv of rows) {
    const days = diffDays(inv.due_date, today);
    if (!REMINDER_DAYS.includes(days as ReminderDay)) {
      results.skipped_off_bucket += 1;
      continue;
    }
    const key = `${inv.dealer_user_id}:${inv.id}:${days}`;
    if (seenKeys.has(key)) {
      results.skipped_dedup += 1;
      continue;
    }

    const { title, intro } = bucketLabel(days as ReminderDay);
    const body =
      `${intro}\n\n` +
      `Fatura: ${inv.invoice_no}\n` +
      `Tutar: ${fmtTry(Number(inv.amount), inv.currency)}\n` +
      `Vade: ${inv.due_date}\n\n` +
      `Ödemek için panelinizdeki Faturalar sayfasını açabilirsiniz.`;

    try {
      const res = await sendNotification({
        userId: inv.dealer_user_id,
        type: "faturalama",
        title,
        body,
        payload: {
          click_target: "/tr/bayi-fatura",
          related_entity_id: inv.id,
          related_entity_type: "bayi_invoices",
          invoice_id: inv.id,
          invoice_no: inv.invoice_no,
          days_bucket: days,
          due_date: inv.due_date,
        },
      });
      if (res.notification_id) {
        results.sent += 1;
        seenKeys.add(key);
      }
    } catch (err) {
      console.error("[cron:bayi-vade-reminder] sendNotification err", inv.id, err);
      results.errors += 1;
    }
  }

  return NextResponse.json({ ok: true, today, ...results });
}
