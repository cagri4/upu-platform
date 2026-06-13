/**
 * Otel AI Asistan Tools — Faz 5 (Pilot)
 *
 * 5 tool:
 *   1. check_availability  — boş oda + fiyat (otel_calculate_total_price RPC)
 *   2. create_reservation_draft — pending rez yarat + onay kuyruğu
 *   3. draft_review_reply  — Google yorum yanıt taslağı + onay kuyruğu
 *   4. draft_guest_message — misafir mesaj taslağı + onay kuyruğu
 *   5. get_pending_reviews — onaylanmamış son yorumlar (mock data)
 *
 * Pilot güvenlik: hiçbir tool DİREKT mesaj yollamaz. Hepsi onay kuyruğuna
 * "pending" düşer; sahip onaylayınca gerçek gönderim (FAZ 6 entegre).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface OtelToolContext {
  sb: SupabaseClient;
  hotelId: string;
  userId: string;
}

export interface OtelTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
  handler: (ctx: OtelToolContext, input: any) => Promise<any>;
}

export const otelTools: OtelTool[] = [
  {
    name: "check_availability",
    description: "Verilen tarih aralığında boş odaları ve toplam fiyatları döndürür. Direkt rezervasyon talebi geldiğinde kullan.",
    input_schema: {
      type: "object",
      properties: {
        check_in: { type: "string", description: "ISO date YYYY-MM-DD" },
        check_out: { type: "string", description: "ISO date YYYY-MM-DD" },
        guests: { type: "number", description: "Kişi sayısı", default: 2 },
      },
      required: ["check_in", "check_out"],
    },
    handler: async (ctx, input) => {
      const { check_in, check_out, guests = 2 } = input;
      if (new Date(check_out) <= new Date(check_in)) {
        return { error: "Çıkış tarihi giriş tarihinden sonra olmalı" };
      }
      const { data: rooms } = await ctx.sb
        .from("otel_rooms")
        .select("id, name, room_type, bed_type, max_occupancy, base_price")
        .eq("hotel_id", ctx.hotelId)
        .neq("status", "out_of_order")
        .gte("max_occupancy", guests);

      const { data: conflicts } = await ctx.sb
        .from("otel_reservations")
        .select("room_id")
        .eq("hotel_id", ctx.hotelId)
        .in("status", ["confirmed", "checked_in", "pending"])
        .lt("check_in", check_out)
        .gt("check_out", check_in);
      const booked = new Set((conflicts || []).map((r: any) => r.room_id));
      const free = (rooms || []).filter(r => !booked.has(r.id));

      const withPrice = await Promise.all(free.map(async r => {
        const { data: t } = await ctx.sb.rpc("otel_calculate_total_price", {
          p_room_id: r.id, p_check_in: check_in, p_check_out: check_out,
        });
        return { id: r.id, name: r.name, room_type: r.room_type, bed_type: r.bed_type,
                 max_occupancy: r.max_occupancy, total_price: Number(t) || 0 };
      }));
      return { check_in, check_out, guests, available_count: withPrice.length, rooms: withPrice };
    },
  },

  {
    name: "create_reservation_draft",
    description: "Pending durumda rez kaydı oluşturur ve sahibin onay kuyruğuna düşer. Misafir bilgileri ve oda seçildikten sonra çağır.",
    input_schema: {
      type: "object",
      properties: {
        room_id: { type: "string" },
        guest_name: { type: "string" },
        guest_phone: { type: "string" },
        guest_email: { type: "string" },
        check_in: { type: "string" },
        check_out: { type: "string" },
        guests: { type: "number" },
        notes: { type: "string" },
      },
      required: ["room_id", "guest_name", "guest_phone", "check_in", "check_out"],
    },
    handler: async (ctx, input) => {
      const { data: avail } = await ctx.sb.rpc("otel_check_room_availability", {
        p_room_id: input.room_id, p_check_in: input.check_in,
        p_check_out: input.check_out, p_exclude_reservation_id: null,
      });
      if (avail === false) return { error: "Bu oda artık dolu" };

      const { data: t } = await ctx.sb.rpc("otel_calculate_total_price", {
        p_room_id: input.room_id, p_check_in: input.check_in, p_check_out: input.check_out,
      });
      const totalPrice = Number(t) || 0;

      const { data: hotelRow } = await ctx.sb
        .from("otel_hotels").select("tenant_id").eq("id", ctx.hotelId).single();
      const { data: rez, error } = await ctx.sb.from("otel_reservations").insert({
        hotel_id: ctx.hotelId,
        tenant_id: hotelRow?.tenant_id,
        room_id: input.room_id,
        guest_name: input.guest_name,
        guest_phone: input.guest_phone,
        guest_email: input.guest_email || null,
        check_in: input.check_in,
        check_out: input.check_out,
        status: "pending",
        source: "ai_assistant",
        total_price: totalPrice,
        notes: input.notes || null,
      }).select("id").single();
      if (error) return { error: error.message };

      // Onay kuyruğuna düşür
      const { data: approval } = await ctx.sb.from("otel_agent_approvals").insert({
        hotel_id: ctx.hotelId,
        agent_role: "direkt_rez",
        action_type: "create_reservation",
        status: "pending",
        draft_content: `${input.guest_name} (${input.guest_phone}) — ${input.check_in} → ${input.check_out}, ${totalPrice} ₺ — sahibin onayı bekleniyor`,
        context: input,
        target_channel: "system",
        related_entity_id: rez.id,
        related_entity_type: "reservation",
      }).select("id").single();

      return { success: true, reservation_id: rez.id, approval_id: approval?.id, total_price: totalPrice,
               message: "Rezervasyon pending kaydedildi, sahibe onay kuyruğuna düştü." };
    },
  },

  {
    name: "get_pending_reviews",
    description: "Henüz yanıtlanmamış (unanswered/draft) son yorumları döndürür. Mock data — gerçek GBP API gelene kadar.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "number", default: 10 } },
    },
    handler: async (ctx, input) => {
      const { data: reviews } = await ctx.sb
        .from("otel_external_reviews")
        .select("id, platform, author_name, rating, language, review_text, review_at, reply_status")
        .eq("hotel_id", ctx.hotelId)
        .in("reply_status", ["unanswered", "draft"])
        .order("review_at", { ascending: false })
        .limit(input.limit || 10);
      return { reviews: reviews || [], total: reviews?.length || 0 };
    },
  },

  {
    name: "draft_review_reply",
    description: "Belirli bir yoruma kişiselleştirilmiş yanıt taslağı kaydeder + sahibin onay kuyruğuna düşer.",
    input_schema: {
      type: "object",
      properties: {
        review_id: { type: "string" },
        reply_text: { type: "string", description: "Yorumcuyla aynı dilde, samimi ve otelin tonunda yanıt" },
      },
      required: ["review_id", "reply_text"],
    },
    handler: async (ctx, input) => {
      const { data: review } = await ctx.sb
        .from("otel_external_reviews")
        .select("id, hotel_id, author_name, review_text, platform")
        .eq("id", input.review_id)
        .eq("hotel_id", ctx.hotelId)
        .single();
      if (!review) return { error: "Yorum bulunamadı" };

      await ctx.sb.from("otel_external_reviews").update({
        draft_reply: input.reply_text, reply_status: "pending_approval", updated_at: new Date().toISOString(),
      }).eq("id", review.id);

      const { data: approval } = await ctx.sb.from("otel_agent_approvals").insert({
        hotel_id: ctx.hotelId,
        agent_role: "itibar",
        action_type: "review_reply",
        status: "pending",
        draft_content: input.reply_text,
        context: { review_id: review.id, author: review.author_name, platform: review.platform },
        target_channel: "google_review",
        target_address: review.id,
        related_entity_id: review.id,
        related_entity_type: "review",
      }).select("id").single();

      return { success: true, approval_id: approval?.id,
               message: `${review.author_name} adlı misafirin yorumuna yanıt taslağı hazır, sahibin onayı bekleniyor.` };
    },
  },

  {
    name: "draft_guest_message",
    description: "Misafire gönderilecek WA/mail mesaj taslağı + sahibin onay kuyruğuna. Varış öncesi rica, hoş çıkış teşekkür, doğum günü, vb.",
    input_schema: {
      type: "object",
      properties: {
        reservation_id: { type: "string" },
        channel: { type: "string", enum: ["wa", "mail"] },
        message_text: { type: "string" },
        purpose: { type: "string", description: "pre_arrival | post_stay | reminder | birthday" },
      },
      required: ["reservation_id", "channel", "message_text"],
    },
    handler: async (ctx, input) => {
      const { data: rez } = await ctx.sb
        .from("otel_reservations")
        .select("id, hotel_id, guest_name, guest_phone, guest_email, check_in, check_out")
        .eq("id", input.reservation_id)
        .eq("hotel_id", ctx.hotelId)
        .single();
      if (!rez) return { error: "Rezervasyon bulunamadı" };

      const targetAddr = input.channel === "wa" ? rez.guest_phone : rez.guest_email;
      if (!targetAddr) return { error: `Misafirin ${input.channel} bilgisi yok` };

      const { data: approval } = await ctx.sb.from("otel_agent_approvals").insert({
        hotel_id: ctx.hotelId,
        agent_role: "misafir_iletisim",
        action_type: "guest_message",
        status: "pending",
        draft_content: input.message_text,
        context: { reservation_id: rez.id, guest_name: rez.guest_name, purpose: input.purpose },
        target_channel: input.channel,
        target_address: targetAddr,
        related_entity_id: rez.id,
        related_entity_type: "reservation",
      }).select("id").single();

      return { success: true, approval_id: approval?.id,
               message: `${rez.guest_name} için ${input.channel === "wa" ? "WhatsApp" : "e-posta"} taslağı hazır, sahibin onayı bekleniyor.` };
    },
  },
];
