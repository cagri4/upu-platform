/**
 * /api/app-version — istemci tarafı PWA update detection için.
 * Vercel her deploy'da VERCEL_GIT_COMMIT_SHA değişir → client bunu poll
 * ederek yeni deploy'u fark eder ve "Yenile" banner gösterir.
 *
 * Cache: no-store, edge'de bile fresh.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_VERSION ||
    "dev";
  return NextResponse.json(
    { version: version.substring(0, 12), timestamp: Date.now() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    },
  );
}
