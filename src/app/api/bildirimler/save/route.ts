/**
 * /api/bildirimler/save — bildirim tercihlerini, DND'yi ve preset adını
 * kaydeder.
 *
 * Validation: Free user Pro türü açmaya çalışırsa reddedilir (UI'da locked
 * gözüküyor; defansif backend kontrolü).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";
import { NOTIFICATION_TYPE_MAP } from "@/platform/notifications/types";

export const dynamic = "force-dynamic";

interface SaveBody {
  token?: string;
  preferences?: Array<{ type: string; enabled: boolean }>;
  dnd?: {
    enabled?: boolean;
    start?: string;
    end?: string;
    timezone?: string;
  };
  preset?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SaveBody;
    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = getServiceClient();
    const userId = auth.userId;

    // Tier kontrolü
    const { data: profile } = await sb
      .from("profiles")
      .select("metadata")
      .eq("id", userId)
      .single();
    const meta = (profile?.metadata as Record<string, unknown> | null) || {};
    const planRaw = meta.plan as string | undefined;
    const isPro = planRaw === "pro";

    // Preferences upsert
    const prefs = Array.isArray(body.preferences) ? body.preferences : [];
    const validPrefs: Array<{ user_id: string; type: string; channel: string; enabled: boolean }> = [];
    for (const p of prefs) {
      const def = NOTIFICATION_TYPE_MAP[p.type];
      if (!def) continue; // bilinmeyen tür
      // Free user Pro türünü ENABLE etmeye çalışırsa reddet
      if (p.enabled && def.tier === "pro" && !isPro) {
        return NextResponse.json(
          { error: `"${def.label}" Pro üyelik gerektiriyor.` },
          { status: 403 },
        );
      }
      validPrefs.push({
        user_id: userId,
        type: p.type,
        channel: "wa",
        enabled: !!p.enabled,
      });
    }

    if (validPrefs.length > 0) {
      const { error: upErr } = await sb
        .from("notification_preferences")
        .upsert(validPrefs, { onConflict: "user_id,type,channel" });
      if (upErr) {
        console.error("[bildirimler:save] upsert", upErr);
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
    }

    // DND + preset → profiles.metadata.notifications
    const newNotif = {
      ...(meta.notifications as Record<string, unknown> | undefined),
      ...(body.dnd ? { dnd: body.dnd } : {}),
      ...(body.preset ? { preset: body.preset } : {}),
    };
    const newMeta = { ...meta, notifications: newNotif };
    const { error: metaErr } = await sb
      .from("profiles")
      .update({ metadata: newMeta })
      .eq("id", userId);
    if (metaErr) {
      console.error("[bildirimler:save] metadata", metaErr);
      return NextResponse.json({ error: metaErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[bildirimler:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
