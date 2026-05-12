/**
 * /api/panel/dashboard — Dashboard KPI count'ları.
 *
 * Auth (cookie öncelikli, /api/panel/me ile aynı pattern):
 *   1) Cookie session geçerse → kullanıcı çözülür, token gerekmez
 *   2) Cookie yoksa + ?t=<token> varsa → magic link doğrula (legacy, eski WA URL'leri)
 *   3) İkisi de yoksa 401
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getSessionFromCookies } from "@/platform/auth/session";
import { sanitizeQuickActions } from "@/platform/quick-actions/keys";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = getServiceClient();
  let userId: string | null = null;

  // 1) Cookie session öncelikli
  const session = await getSessionFromCookies();
  if (session?.uid) {
    userId = session.uid;
  } else {
    // 2) Token query fallback (legacy WA URL'leri)
    const token = req.nextUrl.searchParams.get("t") || req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
    const { data: pt } = await sb
      .from("magic_link_tokens")
      .select("user_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!pt) return NextResponse.json({ error: "Geçersiz link" }, { status: 404 });
    if (new Date(pt.expires_at) < new Date()) {
      return NextResponse.json({ error: "Linkin süresi dolmuş" }, { status: 400 });
    }
    userId = pt.user_id;
  }

  if (!userId) return NextResponse.json({ error: "Oturum çözülemedi" }, { status: 401 });

  // Paralel count sorguları + profile (web_slug için) + subscription
  const [propsRes, custRes, contractsRes, presRes, trackingRes, calendarRes, profileRes, subRes] = await Promise.all([
    sb.from("emlak_properties").select("*", { count: "exact", head: true }).eq("user_id", userId).neq("status", "deleted"),
    sb.from("emlak_customers").select("*", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
    sb.from("contracts").select("*", { count: "exact", head: true }).eq("user_id", userId).neq("status", "cancelled").neq("status", "deleted"),
    sb.from("emlak_presentations").select("*", { count: "exact", head: true }).eq("user_id", userId).neq("status", "deleted"),
    sb.from("emlak_tracking_criteria").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("active", true),
    sb.from("emlak_calendar_events").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending"),
    sb.from("profiles").select("metadata").eq("id", userId).single(),
    sb.from("subscriptions").select("plan, status, trial_ends_at, current_period_end, cancel_at_period_end").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const meta = (profileRes.data?.metadata as Record<string, unknown> | null) || {};
  const agent = (meta.agent_profile as { web_slug?: string } | undefined);
  const webSlug = agent?.web_slug || null;

  // Hızlı işlem tercihleri — kullanıcı seçmediyse null döner, client fallback uygular.
  const quickActions = sanitizeQuickActions(meta.quick_actions);

  // Subscription özeti — panel kartı için
  const sub = subRes.data;
  let subscription: {
    plan: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    daysLeft: number | null;
  } | null = null;
  if (sub) {
    let daysLeft: number | null = null;
    if (sub.plan === "trial" && sub.trial_ends_at) {
      daysLeft = Math.max(0, Math.ceil((new Date(sub.trial_ends_at as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
    subscription = {
      plan: sub.plan as string,
      status: sub.status as string,
      trial_ends_at: (sub.trial_ends_at as string | null) ?? null,
      current_period_end: (sub.current_period_end as string | null) ?? null,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      daysLeft,
    };
  }

  return NextResponse.json({
    success: true,
    kpis: {
      properties: propsRes.count || 0,
      customers: custRes.count || 0,
      contracts: contractsRes.count || 0,
      presentations: presRes.count || 0,
      tracking: trackingRes.count || 0,
      calendar: calendarRes.count || 0,
    },
    webSlug,
    subscription,
    quickActions,
  });
}
