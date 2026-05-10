/**
 * /api/calendar/save — takvim event ekle veya düzenle.
 * POST { token, id?, title, description?, scheduled_at, related_customer_id?, related_property_id? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { resolvePanelAuthFromBody } from "@/platform/auth/panel-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, description, scheduled_at, related_customer_id, related_property_id } = body || {};

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Başlık zorunlu." }, { status: 400 });
    }
    if (!scheduled_at) return NextResponse.json({ error: "Tarih ve saat zorunlu." }, { status: 400 });
    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Geçersiz tarih." }, { status: 400 });
    }

    const auth = await resolvePanelAuthFromBody(req, body);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const sb = getServiceClient();
    const payload = {
      title: title.trim().slice(0, 100),
      description: description ? String(description).slice(0, 500) : null,
      scheduled_at: scheduledDate.toISOString(),
      related_customer_id: related_customer_id || null,
      related_property_id: related_property_id || null,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      // UPDATE — pending events için
      const { error } = await sb.from("emlak_calendar_events")
        .update(payload)
        .eq("id", id)
        .eq("user_id", auth.userId)
        .eq("status", "pending"); // sent/failed events düzenlenmez
      if (error) {
        console.error("[calendar:save] update", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, id });
    }

    // INSERT
    const { data: inserted, error } = await sb.from("emlak_calendar_events")
      .insert({
        user_id: auth.userId,
        ...payload,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !inserted) {
      console.error("[calendar:save] insert", error);
      return NextResponse.json({ error: error?.message || "Kaydedilemedi." }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: inserted.id });
  } catch (err) {
    console.error("[calendar:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
