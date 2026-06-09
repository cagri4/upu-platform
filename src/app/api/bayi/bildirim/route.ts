/**
 * GET   /api/bayi/bildirim — bildirim listesi (yeni → eski).
 * PATCH /api/bayi/bildirim — toplu okundu işaretle.
 *   body: { ids?: number[] }  ids yoksa hepsini okundu yap.
 *
 * Mevcut `notifications` tablosu kullanılır (sistem geneli).
 */
import { NextRequest, NextResponse } from "next/server";
import { getBayiAuth } from "../_auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE_DEFAULT = 30;

export async function GET(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, userId } = auth;

  const url = new URL(req.url);
  const unread = url.searchParams.get("unread") === "1";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") || `${PAGE_SIZE_DEFAULT}`, 10)),
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = sb
    .from("notifications")
    .select("id, type, title, body, payload, is_read, channels_sent, created_at, read_at", {
      count: "exact",
    })
    .eq("user_id", userId);

  if (unread) query = query.eq("is_read", false);

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error("[bayi:bildirim:list]", error);
    return NextResponse.json({ error: "Yüklenemedi." }, { status: 500 });
  }

  const { count: unreadCount } = await sb
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  return NextResponse.json({
    success: true,
    items: (data ?? []).map((n) => ({
      id: Number(n.id),
      type: n.type as string,
      title: (n.title as string) || "",
      body: (n.body as string) || "",
      payload: (n.payload as Record<string, unknown>) || null,
      isRead: Boolean(n.is_read),
      channelsSent: (n.channels_sent as string[]) || [],
      createdAt: n.created_at as string,
      readAt: (n.read_at as string) || null,
    })),
    total: count ?? 0,
    unread: unreadCount ?? 0,
    page,
    pageSize,
  });
}

interface PatchBody {
  ids?: number[];
}

export async function PATCH(req: NextRequest) {
  const auth = await getBayiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, userId } = auth;

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x) => typeof x === "number")
    : null;

  const update = {
    is_read: true,
    read_at: new Date().toISOString(),
  };

  let query = sb
    .from("notifications")
    .update(update)
    .eq("user_id", userId)
    .eq("is_read", false);

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { error } = await query;
  if (error) {
    console.error("[bayi:bildirim:patch]", error);
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
