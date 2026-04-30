/**
 * GET /api/cron/bayi-fair-use — haftalık fair-use uyarısı
 *
 * Bayi tier'ında bayi sayısı veya WA mesaj/ay tavanını aşan owner'lara
 * yumuşak uyarı gönderir (sert engel yok). Müşteri ilişkisi bozulmaz,
 * ama upgrade tavsiyesi mesaj olarak gider.
 *
 * Cron schedule (Vercel cron): Pazartesi 09:00 NL time.
 * vercel.json:
 *   { "crons": [{ "path": "/api/cron/bayi-fair-use", "schedule": "0 8 * * 1" }] }
 *
 * Auth: CRON_SECRET header check (Vercel cron otomatik gönderir).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { TIER_FEATURES } from "@/tenants/bayi/billing/tier-features";
import { sendText } from "@/platform/whatsapp/send";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel cron auth
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  // Tüm bayi tenant owner'ları (admin/user role + bayi tenant)
  const { data: owners } = await supabase
    .from("profiles")
    .select("id, whatsapp_phone, metadata, tenant_id, tenants!inner(saas_type)")
    .in("role", ["admin", "user"])
    .eq("tenants.saas_type", "bayi")
    .not("whatsapp_phone", "is", null);

  if (!owners || owners.length === 0) {
    return NextResponse.json({ ok: true, checked: 0 });
  }

  let warned = 0;
  for (const owner of owners) {
    const meta = (owner.metadata || {}) as Record<string, unknown>;
    const tier = (meta.tier as "starter" | "growth" | "pro") || "starter";
    const features = TIER_FEATURES[tier];
    const phone = owner.whatsapp_phone as string;

    // Bayi sayısı tavanı
    const { count: dealerCount } = await supabase
      .from("bayi_dealers")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", owner.tenant_id);
    const dealers = dealerCount || 0;

    // WA mesaj/ay (bot_activity tablosu üstünden son 30 gün)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: msgCount } = await supabase
      .from("bot_activity")
      .select("id", { count: "exact", head: true })
      .eq("user_id", owner.id)
      .gte("created_at", monthAgo);
    const messages = msgCount || 0;

    const dealerOver = features.dealersFairUse !== null && dealers > features.dealersFairUse;
    const messageOver = features.waMessagesFairUseMonth !== null && messages > features.waMessagesFairUseMonth;

    if (!dealerOver && !messageOver) continue;

    const upgradeTier = tier === "starter" ? "Growth" : "Pro";
    const lines: string[] = [];
    if (dealerOver) {
      lines.push(`• Bayi sayısı: ${dealers} (${tier} paketi adil kullanım: ${features.dealersFairUse})`);
    }
    if (messageOver) {
      lines.push(`• WhatsApp mesaj/ay: ${messages} (${tier} paketi adil kullanım: ${features.waMessagesFairUseMonth})`);
    }

    try {
      await sendText(phone,
        `📊 *Adil Kullanım Bildirimi*\n\n` +
        `Sistemi yoğun kullanıyorsunuz, harika! Mevcut paketinizi aşan kullanım var:\n\n` +
        lines.join("\n") + "\n\n" +
        `Bu *engel değil* — şu an her şey çalışmaya devam ediyor. Ama büyümenize uygun ${upgradeTier} paketine geçmek size daha avantajlı olabilir.\n\n` +
        `Detay: retailai.upudev.nl/tr#pricing`,
      );
      warned++;
    } catch (err) {
      console.error("[bayi-fair-use] send fail", owner.id, err);
    }
  }

  return NextResponse.json({ ok: true, checked: owners.length, warned });
}
