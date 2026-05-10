/**
 * /api/bildirimler/init — kullanıcının bildirim tercihlerini, DND ayarını ve
 * tier (free/pro) bilgisini döner.
 *
 * Kayıt yoksa default preferences (Free açık, Pro kapalı) otomatik insert
 * edilir — bildirimler sayfası ilk açıldığında "boş" görünmesin.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuth } from "@/platform/auth/panel-auth";
import { isPro } from "@/platform/billing/is-pro";
import { NOTIFICATION_TYPES, getDefaultPreferences } from "@/platform/notifications/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await resolvePanelAuth(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sb = getServiceClient();
  const userId = auth.userId;

  // Mevcut preferences
  const { data: existing } = await sb
    .from("notification_preferences")
    .select("type, channel, enabled")
    .eq("user_id", userId)
    .eq("channel", "wa");

  const existingMap = new Map<string, boolean>();
  for (const p of existing || []) {
    existingMap.set(p.type as string, p.enabled as boolean);
  }

  // Eksik kayıtları default ile doldur (idempotent — kayıt sayısı artar
  // ama unique constraint upsert ile güvenli).
  const defaults = getDefaultPreferences();
  const toInsert = defaults
    .filter(d => !existingMap.has(d.type))
    .map(d => ({ user_id: userId, type: d.type, channel: "wa", enabled: d.enabled }));
  if (toInsert.length > 0) {
    await sb.from("notification_preferences").upsert(toInsert, {
      onConflict: "user_id,type,channel",
      ignoreDuplicates: true,
    });
    for (const ins of toInsert) existingMap.set(ins.type, ins.enabled);
  }

  // Sadece katalog'da olan türleri döndür (eski/silinmiş türler ignore)
  const preferences = NOTIFICATION_TYPES.map(t => ({
    type: t.type,
    enabled: existingMap.get(t.type) ?? (t.tier === "free"),
  }));

  // Profile metadata: dnd + preset
  const { data: profile } = await sb
    .from("profiles")
    .select("metadata")
    .eq("id", userId)
    .single();
  const meta = (profile?.metadata as Record<string, unknown> | null) || {};
  const notif = (meta.notifications as { dnd?: unknown; preset?: string } | undefined) || {};

  // Tier: subscriptions table'dan (trial active veya Pro abonelik) — metadata.plan
  // legacy fallback artık kullanılmıyor.
  const tier: "free" | "pro" = (await isPro(userId)) ? "pro" : "free";

  return NextResponse.json({
    success: true,
    preferences,
    dnd: notif.dnd || { enabled: false, start: "23:00", end: "08:00" },
    preset: notif.preset || "ozel",
    tier,
  });
}
