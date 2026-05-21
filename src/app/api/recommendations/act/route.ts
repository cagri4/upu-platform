/**
 * POST /api/recommendations/act — kullanıcı bir öneriyi act/dismiss eder.
 * Body: { id, choice: 'accept' | 'dismiss' }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAuthFromBody } from "@/platform/auth/require-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const auth = await requireAuthFromBody(req, body);
  if ("error" in auth) return auth.error;

  const id = String(body.id || "").trim();
  const choice = String(body.choice || "").trim();
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  if (!["accept", "dismiss"].includes(choice)) {
    return NextResponse.json({ error: "choice 'accept' veya 'dismiss'." }, { status: 400 });
  }

  const sb = getServiceClient();
  const now = new Date().toISOString();
  const update = choice === "accept"
    ? { status: "acted", acted_at: now }
    : { status: "dismissed", dismissed_at: now };

  const { error } = await sb.from("recommendation_runs")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
