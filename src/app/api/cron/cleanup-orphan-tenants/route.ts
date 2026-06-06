/**
 * GET /api/cron/cleanup-orphan-tenants — saatlik orphan tenant cleanup.
 *
 * Defense-in-depth: KATMAN B outer try/catch eklendi ama yine de runtime
 * tamamen önlenemeyen edge case'ler için (process kill, DB connection drop)
 * bu cron ek koruma sağlar.
 *
 * Mantık:
 *   1. tenants.created_at < now() - 10 dakika
 *   2. profile-suz (LEFT JOIN profiles NULL)
 *   3. id NOT IN config DEMO 7 UUID (sabit hard-exclude)
 *   4. FK constraint için bağlı tabloları (agent_quotas, command_sessions, vd.)
 *      önce temizle, sonra tenant'ı sil
 *   5. Audit log: hangi tenant ne zaman silindi (response payload)
 *
 * Schedule: hourly (`0 * * * *` in vercel.json).
 *
 * Yetki: Bearer ${CRON_SECRET} (Vercel cron otomatik header gönderir).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/platform/auth/supabase";
import { getAllTenants } from "@/tenants/config";

export const dynamic = "force-dynamic";

const DEPENDENT_TABLES = [
  "agent_quotas",
  "command_sessions",
  "invite_codes",
  "magic_link_tokens",
  "magic_links",
  "audit_log",
];

const TEN_MINUTES_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getServiceClient();

  // Config DEMO UUID'leri — hard-exclude (silinmesin)
  const demoIds = new Set(
    getAllTenants()
      .map((t) => t.tenantId)
      .filter((id): id is string => Boolean(id)),
  );

  const cutoffIso = new Date(Date.now() - TEN_MINUTES_MS).toISOString();

  // Aday tenant'ları çek: 10 dk'dan eski + DEMO değil
  const { data: candidates, error: candErr } = await sb
    .from("tenants")
    .select("id, saas_type, slug, name, created_at")
    .lt("created_at", cutoffIso);
  if (candErr) {
    console.error("[cron:cleanup-orphan-tenants] candidate fetch failed", candErr);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  const nonDemoCandidates = (candidates ?? []).filter((t) => !demoIds.has(t.id));
  if (nonDemoCandidates.length === 0) {
    return NextResponse.json({ scanned: 0, deleted: 0, reason: "no_candidates" });
  }

  // Profile-suz olanları belirle
  const candidateIds = nonDemoCandidates.map((t) => t.id);
  const { data: profilesInCandidates } = await sb
    .from("profiles")
    .select("tenant_id")
    .in("tenant_id", candidateIds);
  const haveProfiles = new Set(
    (profilesInCandidates ?? []).map((p) => p.tenant_id as string),
  );
  const orphans = nonDemoCandidates.filter((t) => !haveProfiles.has(t.id));

  const deleted: Array<{ id: string; saas_type: string; slug: string }> = [];
  const failed: Array<{ id: string; reason: string }> = [];

  for (const t of orphans) {
    // Dependent rows önce
    for (const tbl of DEPENDENT_TABLES) {
      const { error: cntErr } = await sb
        .from(tbl)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", t.id);
      if (cntErr) continue;
      await sb.from(tbl).delete().eq("tenant_id", t.id);
    }

    const { error: delErr } = await sb.from("tenants").delete().eq("id", t.id);
    if (delErr) {
      console.error("[cron:cleanup-orphan-tenants] delete failed", t.id, delErr);
      failed.push({ id: t.id, reason: delErr.message });
      continue;
    }
    deleted.push({ id: t.id, saas_type: t.saas_type, slug: t.slug });
    console.log(
      `[cron:cleanup-orphan-tenants] deleted ${t.id} (${t.saas_type}/${t.slug}) created=${t.created_at}`,
    );
  }

  return NextResponse.json({
    scanned: nonDemoCandidates.length,
    deleted: deleted.length,
    failed: failed.length,
    deletedTenants: deleted,
    failures: failed,
    cutoff: cutoffIso,
  });
}
