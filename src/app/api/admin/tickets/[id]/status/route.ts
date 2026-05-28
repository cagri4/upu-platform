/**
 * /api/admin/tickets/[id]/status — ticket status değiştir.
 * Body: { status: 'open'|'in_progress'|'replied'|'resolved'|'closed' }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { requireAdminUser } from "@/platform/admin/auth";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["open", "in_progress", "replied", "resolved", "closed"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminUser(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const ticketId = parseInt(id, 10);
    if (!Number.isFinite(ticketId)) {
      return NextResponse.json({ error: "Geçersiz id." }, { status: 400 });
    }
    const body = await req.json();
    const newStatus = typeof body.status === "string" ? body.status : "";
    if (!ALLOWED.has(newStatus)) {
      return NextResponse.json({ error: "Geçersiz status." }, { status: 400 });
    }

    const sb = getServiceClient();
    const { error } = await sb
      .from("support_tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);
    if (error) {
      console.error("[admin/tickets:status]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/tickets:status]", err);
    return NextResponse.json({ error: "Bir hata oluştu." }, { status: 500 });
  }
}
