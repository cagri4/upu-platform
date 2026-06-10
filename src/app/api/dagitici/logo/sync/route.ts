/**
 * POST /api/dagitici/logo/sync — Logo Tiger sync manuel tetik.
 *
 * body: { entities?: ('products'|'stock'|'prices'|'dealers')[] }
 *   entities yoksa hepsi sırayla çalışır.
 *
 * Sandbox/canlı yapılandırılmamışsa mock veri ile DB'ye INSERT yapılır;
 * dağıtıcı "Logo entegrasyonu nasıl olur" örnek senaryo görür.
 *
 * Faz 3+ cron: vercel.json'a günlük schedule eklenir → bu endpoint
 * service-role kullanılır. Hobby plan günlük 1 cron limit'i yüzünden
 * 4 entity tek seferde, sabah saatinde çalışır.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDagiticiAuth } from "../../_auth";
import { runLogoSync } from "@/platform/erp/logo-tiger/sync";
import type { SyncEntity } from "@/platform/erp/logo-tiger/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface SyncBody {
  entities?: string[];
}

const VALID = new Set<SyncEntity>(["products", "stock", "prices", "dealers"]);

export async function POST(req: NextRequest) {
  const auth = await getDagiticiAuth(req);
  if ("error" in auth) return auth.error;
  const { sb, tenantId } = auth;

  const body = (await req.json().catch(() => ({}))) as SyncBody;
  const entities: SyncEntity[] = (body.entities ?? [])
    .filter((e): e is SyncEntity => VALID.has(e as SyncEntity));

  const result = await runLogoSync(sb, { tenantId, entities });

  return NextResponse.json({
    success: result.ok,
    stats: result.stats,
    errorMessage: result.errorMessage,
  });
}
