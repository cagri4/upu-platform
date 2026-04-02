/**
 * /yorumlar — Guest reviews listing with filters
 */

import type { WaContext } from "@/platform/whatsapp/types";
import { sendButtons } from "@/platform/whatsapp/send";
import { getServiceClient } from "@/platform/auth/supabase";
import { getHotelId, prefix, NO_HOTEL_MSG } from "./helpers";

export async function handleYorumlar(ctx: WaContext): Promise<void> {
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) {
    await sendButtons(ctx.phone, NO_HOTEL_MSG, [{ id: "cmd:menu", title: "Ana Menu" }]);
    return;
  }

  await sendButtons(ctx.phone,
    prefix("deneyim", "*Misafir Yorumlari*\n\nHangi yorumlari gormek istersiniz?"),
    [
      { id: "yorum_filter:recent", title: "Son Yorumlar" },
      { id: "yorum_filter:low", title: "Dusuk Puanlilar" },
      { id: "yorum_filter:all", title: "Tumu" },
    ],
  );
}

// ── Callback handler ────────────────────────────────────────────────────

export async function handleYorumlarCallback(ctx: WaContext, data: string): Promise<void> {
  if (!data.startsWith("yorum_filter:")) return;

  const filter = data.replace("yorum_filter:", "");
  const hotelId = await getHotelId(ctx.userId, ctx.tenantId);
  if (!hotelId) return;

  try {
    const supabase = getServiceClient();
    let query = supabase
      .from("otel_guest_reviews")
      .select("id, guest_name, rating, comment, response, created_at")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (filter === "low") {
      query = query.lte("rating", 3);
    } else if (filter === "recent") {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      query = query.gte("created_at", weekAgo);
    }

    const { data: reviews } = await query;

    if (!reviews?.length) {
      const labels: Record<string, string> = { recent: "son 7 gunde", low: "dusuk puanli", all: "" };
      await sendButtons(ctx.phone,
        prefix("deneyim", `${labels[filter] ? `Bu donemde ${labels[filter]}` : ""} yorum bulunmuyor.`),
        [{ id: "cmd:menu", title: "Ana Menu" }],
      );
      return;
    }

    // Calculate average
    const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
    const avgStr = avg.toFixed(1);

    const lines = reviews.map((r: any, i: number) => {
      const stars = "★".repeat(r.rating || 0) + "☆".repeat(5 - (r.rating || 0));
      const date = new Date(r.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
      const responded = r.response ? " ✅" : "";
      const comment = r.comment ? `\n   "${r.comment.substring(0, 80)}${r.comment.length > 80 ? "..." : ""}"` : "";
      return `${i + 1}. ${r.guest_name} ${stars} (${date})${responded}${comment}`;
    });

    const filterLabels: Record<string, string> = {
      recent: "Son 7 Gun",
      low: "Dusuk Puanli",
      all: "Tum Yorumlar",
    };

    let text = `*${filterLabels[filter]}* (${reviews.length} yorum)\n`;
    text += `Ortalama puan: ${avgStr}/5\n\n`;
    text += lines.join("\n\n");

    await sendButtons(ctx.phone, prefix("deneyim", text), [
      { id: "cmd:rapor", title: "Rapor" },
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  } catch (err) {
    console.error("[otel:yorumlar] error:", err);
    await sendButtons(ctx.phone, "Yorumlar yuklenirken hata olustu.", [
      { id: "cmd:menu", title: "Ana Menu" },
    ]);
  }
}
