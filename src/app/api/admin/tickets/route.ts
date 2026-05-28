/**
 * /api/admin/tickets — admin liste endpoint'i.
 *
 * Filtre: ?status=open|in_progress|replied|resolved|closed|all
 *         ?search=<konu veya kullanıcı adı>
 *         ?since=24h|7d|30d|all
 * Yanıt: { tickets: [{id, subject, status, user, last_message, ...}],
 *         stats: { open, in_progress, replied, resolved, closed, today, avgResponseHours } }
 *
 * Auth: requireAdminUser (cookie session/token → profiles.role == 'admin').
 *   NOT a middleware domain gate — middleware skips all /api/ paths.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  const sb = getServiceClient();
  const url = req.nextUrl;
  const statusFilter = url.searchParams.get("status") || "all";
  const search = (url.searchParams.get("search") || "").trim();
  const since = url.searchParams.get("since") || "all";

  let q = sb
    .from("support_tickets")
    .select("id, user_id, subject, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") {
    q = q.eq("status", statusFilter);
  }
  if (since !== "all") {
    const hours = since === "24h" ? 24 : since === "7d" ? 24 * 7 : since === "30d" ? 24 * 30 : 0;
    if (hours > 0) {
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      q = q.gte("created_at", cutoff);
    }
  }
  if (search) {
    q = q.ilike("subject", `%${search}%`);
  }

  const { data: tickets, error } = await q;
  if (error) {
    console.error("[admin/tickets:list]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (tickets || []).map(t => t.id as number);
  const userIds = [...new Set((tickets || []).map(t => t.user_id as string))];

  const { data: profiles } = userIds.length
    ? await sb.from("profiles").select("id, display_name, whatsapp_phone, email").in("id", userIds)
    : { data: [] };
  const profileMap = new Map<string, { name: string; phone: string | null; email: string | null }>();
  for (const p of profiles || []) {
    profileMap.set(p.id as string, {
      name: (p.display_name as string) || "İsimsiz",
      phone: (p.whatsapp_phone as string | null) ?? null,
      email: (p.email as string | null) ?? null,
    });
  }

  const lastMsgMap = new Map<number, { message: string; sender_type: string; created_at: string }>();
  if (ids.length > 0) {
    const { data: msgs } = await sb
      .from("support_messages")
      .select("ticket_id, message, sender_type, created_at")
      .in("ticket_id", ids)
      .eq("internal_note", false)
      .order("created_at", { ascending: false });
    for (const m of msgs || []) {
      const tid = m.ticket_id as number;
      if (!lastMsgMap.has(tid)) {
        lastMsgMap.set(tid, {
          message: (m.message as string).slice(0, 200),
          sender_type: m.sender_type as string,
          created_at: m.created_at as string,
        });
      }
    }
  }

  // Stats — bütün ticket'lar üzerinden (filtre değil)
  const { data: all } = await sb
    .from("support_tickets")
    .select("status, created_at");
  const stats = {
    open: 0,
    in_progress: 0,
    replied: 0,
    resolved: 0,
    closed: 0,
    today: 0,
    total: (all || []).length,
  };
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  for (const a of all || []) {
    const s = a.status as keyof typeof stats;
    if (s in stats) stats[s] = (stats[s] as number) + 1;
    if (new Date(a.created_at as string) >= todayStart) stats.today += 1;
  }

  // Mostly search by name (post-filter)
  let items = (tickets || []).map(t => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    created_at: t.created_at,
    updated_at: t.updated_at,
    user: profileMap.get(t.user_id as string) || { name: "İsimsiz", phone: null, email: null },
    last_message: lastMsgMap.get(t.id as number) || null,
  }));
  if (search) {
    const lower = search.toLowerCase();
    items = items.filter(
      t => (t.subject as string).toLowerCase().includes(lower) || t.user.name.toLowerCase().includes(lower),
    );
  }

  return NextResponse.json({ tickets: items, stats });
}
