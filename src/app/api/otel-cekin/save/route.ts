/**
 * POST /api/otel-cekin/save — online check-in form submit (atomic).
 *
 * Body: {
 *   token,
 *   id_photo_url,           // upload-id dönüşü
 *   preferences: { eta?, breakfast_diet?, allergies?, smoking?, pillow? },
 *   kvkk_accepted: boolean,
 *   marketing_opt_in: boolean,
 * }
 *
 * Atomik yan-etkiler:
 *   - otel_pre_checkins INSERT/UPSERT (multi-use form: aynı rez için tek satır)
 *   - otel_reservations.pre_checkin_complete = true
 *   - profiles.metadata.marketing_opt_in (eğer tik)
 *   - WA → misafir: tamamlandı
 *   - WA → resepsiyon (PRE_CHECKIN_VIEW yetkili): bildirim
 *
 * NOT: token used_at işaretlenmez — multi-use, geri dönüp düzeltebilir.
 * 72h TTL doğal olarak kapatır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { sendButtons } from "@/platform/whatsapp/send";
import { OTEL_CAPABILITIES } from "@/tenants/otel/capabilities";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  token?: string;
  id_photo_url?: string;
  preferences?: Record<string, unknown>;
  kvkk_accepted?: boolean;
  marketing_opt_in?: boolean;
  // FAZ 3 — KBS kimlik alanları
  tc_no?: string;
  birth_date?: string;
  nationality?: string;
  mother_name?: string;
  father_name?: string;
  id_type?: string;
  id_number?: string;
  gender?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.token) return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
    if (!body.kvkk_accepted) {
      return NextResponse.json({ error: "Devam etmek için KVKK onayı gerekli." }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: magicToken } = await supabase
      .from("magic_link_tokens")
      .select("id, user_id, expires_at, purpose, metadata")
      .eq("token", body.token)
      .maybeSingle();

    if (!magicToken) return NextResponse.json({ error: "Geçersiz link." }, { status: 404 });
    if (new Date(magicToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş." }, { status: 400 });
    }
    if (magicToken.purpose !== "otel-pre-checkin") {
      return NextResponse.json({ error: "Bu link check-in için değil." }, { status: 400 });
    }

    const meta = (magicToken.metadata || {}) as Record<string, unknown>;
    const reservationId = meta.reservation_id as string | undefined;
    if (!reservationId) {
      return NextResponse.json({ error: "Rezervasyon bağlantısı eksik." }, { status: 400 });
    }

    const { data: rez } = await supabase
      .from("otel_reservations")
      .select("id, hotel_id, guest_name, guest_phone, guest_profile_id, check_in")
      .eq("id", reservationId)
      .maybeSingle();
    if (!rez) return NextResponse.json({ error: "Rezervasyon bulunamadı." }, { status: 404 });

    // Mevcut kayıt var mı? (multi-use → upsert)
    const { data: existing } = await supabase
      .from("otel_pre_checkins")
      .select("id")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    const payload = {
      reservation_id: reservationId,
      hotel_id: rez.hotel_id,
      guest_profile_id: rez.guest_profile_id || magicToken.user_id,
      id_photo_url: body.id_photo_url || null,
      preferences: body.preferences || {},
      kvkk_accepted_at: new Date().toISOString(),
      marketing_opt_in: !!body.marketing_opt_in,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // FAZ 3 — KBS kimlik alanları
      tc_no: body.tc_no?.trim() || null,
      birth_date: body.birth_date || null,
      nationality: body.nationality?.trim() || null,
      mother_name: body.mother_name?.trim() || null,
      father_name: body.father_name?.trim() || null,
      id_type: body.id_type?.trim() || null,
      id_number: body.id_number?.trim() || null,
      gender: body.gender?.trim() || null,
    };

    if (existing) {
      const { error: updErr } = await supabase
        .from("otel_pre_checkins")
        .update(payload)
        .eq("id", existing.id);
      if (updErr) {
        console.error("[otel-cekin:save] update err", updErr);
        return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
      }
    } else {
      const { error: insErr } = await supabase
        .from("otel_pre_checkins")
        .insert(payload);
      if (insErr) {
        console.error("[otel-cekin:save] insert err", insErr);
        return NextResponse.json({ error: "Kaydedilemedi." }, { status: 500 });
      }
    }

    await supabase
      .from("otel_reservations")
      .update({ pre_checkin_complete: true })
      .eq("id", reservationId);

    // FAZ 3 — Online check-in tamamlanınca otomatik KBS submission (mock)
    // Best-effort: hata olsa dahi misafir formu tamamlanır.
    try {
      const hasIdentity = body.tc_no || body.id_number;
      if (hasIdentity) {
        const { data: existingSub } = await supabase
          .from("otel_kbs_submissions")
          .select("id, status")
          .eq("reservation_id", reservationId)
          .in("status", ["accepted", "pending", "sent"])
          .maybeSingle();
        if (!existingSub) {
          const { data: hotelRow } = await supabase
            .from("otel_hotels").select("name").eq("id", rez.hotel_id).maybeSingle();
          const { data: rezFull } = await supabase
            .from("otel_reservations").select("check_out").eq("id", reservationId).maybeSingle();
          const { submitKbsMock } = await import("@/platform/kbs/mock-client");
          const result = await submitKbsMock({
            guest: {
              guest_name: rez.guest_name || "—",
              tc_no: body.tc_no || null,
              id_type: body.id_type || null,
              id_number: body.id_number || null,
              birth_date: body.birth_date || null,
              nationality: body.nationality || null,
              mother_name: body.mother_name || null,
              father_name: body.father_name || null,
              gender: body.gender || null,
            },
            stay: {
              check_in: rez.check_in,
              check_out: rezFull?.check_out || rez.check_in,
              room_name: null,
            },
            hotel: { hotel_name: hotelRow?.name || "—", hotel_id: rez.hotel_id },
          });
          const now = new Date().toISOString();
          await supabase.from("otel_kbs_submissions").insert({
            reservation_id: reservationId,
            hotel_id: rez.hotel_id,
            status: result.status,
            payload: { guest: { guest_name: rez.guest_name, tc_no: body.tc_no, birth_date: body.birth_date } },
            kbs_response: result.raw_response,
            kbs_reference: result.reference_no,
            error_message: result.error_message,
            is_mock: true,
            sent_at: now,
            accepted_at: result.status === "accepted" ? now : null,
            rejected_at: result.status === "rejected" ? now : null,
          });
        }
      }
    } catch (err) {
      console.error("[otel-cekin:save] kbs mock submit error", err);
    }

    if (body.marketing_opt_in && rez.guest_profile_id) {
      // profile.metadata içinde marketing_opt_in flag güncelle
      const { data: prof } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", rez.guest_profile_id)
        .maybeSingle();
      const newMeta = { ...((prof?.metadata as Record<string, unknown>) || {}), marketing_opt_in: true };
      await supabase
        .from("profiles")
        .update({ metadata: newMeta })
        .eq("id", rez.guest_profile_id);
    }

    // WA misafir bildirimi
    if (rez.guest_phone) {
      try {
        await sendButtons(rez.guest_phone,
          `✅ *Online check-in tamamlandı!*\n\nOtele geldiğinizde anahtar kartınız hazır olacak. Konaklamanız boyunca herhangi bir talebiniz için "talep" yazabilirsiniz.`,
          [
            { id: "cmd:rezervasyonum", title: "📌 Rezervasyon" },
            { id: "cmd:menu", title: "Ana Menü" },
          ],
        );
      } catch { /* ignore */ }
    }

    // Resepsiyona bildirim — PRE_CHECKIN_VIEW yetkili tüm personel
    const { data: staff } = await supabase
      .from("profiles")
      .select("whatsapp_phone, capabilities")
      .eq("tenant_id", (await supabase.from("tenants").select("id").eq("saas_type", "otel").maybeSingle()).data?.id || "")
      .in("role", ["admin", "employee"])
      .not("whatsapp_phone", "is", null);

    const targetCap = OTEL_CAPABILITIES.PRE_CHECKIN_VIEW as string;
    const targets = (staff || []).filter(s => {
      const caps = (s.capabilities as string[] | null) || [];
      return caps.includes(targetCap) || caps.includes("*");
    });

    const notif = `📝 *Online check-in tamamlandı*\n\n👤 ${rez.guest_name || "Misafir"}\n📅 Giriş: ${rez.check_in}\n\nKimlik + tercih hazır. Misafir geldiğinde anahtar kartını verebilirsiniz.`;
    for (const t of targets) {
      try {
        await sendButtons(t.whatsapp_phone!, notif, [
          { id: "cmd:rezervasyonlar", title: "📅 Rezervasyonlar" },
          { id: "cmd:menu", title: "Ana Menü" },
        ]);
      } catch { /* ignore */ }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[otel-cekin:save]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
