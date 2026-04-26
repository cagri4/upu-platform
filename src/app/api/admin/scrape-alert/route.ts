import { NextResponse } from "next/server";
import { sendAdminAlert } from "@/platform/admin/commands";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { message?: string };
    const message = (body?.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }
    await sendAdminAlert(message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scrape-alert] error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
