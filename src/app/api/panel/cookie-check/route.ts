/**
 * GET /api/panel/cookie-check
 *
 * Form sayfalarında "Link doğrulanıyor" loading state'inin gereksiz olduğunu
 * hızlıca anlamak için kullanılır. Cookie session varsa 200 döner; yoksa 401.
 *
 * DB sorgusu yapmaz — sadece imzalı cookie decode (50ms altı).
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/platform/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session?.uid) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, profileId: session.uid });
}
